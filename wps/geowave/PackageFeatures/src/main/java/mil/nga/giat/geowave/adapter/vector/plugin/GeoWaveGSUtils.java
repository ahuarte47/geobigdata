/*******************************************************************************
 * Copyright (c) 2013-2017 Contributors to the Eclipse Foundation
 * 
 * See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Apache License,
 * Version 2.0 which accompanies this distribution and is available at
 * http://www.apache.org/licenses/LICENSE-2.0.txt
 *******************************************************************************
 */
package mil.nga.giat.geowave.adapter.vector.plugin;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.zip.Deflater;

import org.geotools.data.simple.SimpleFeatureIterator;
import org.geotools.geometry.jts.JTS;
import org.geotools.process.ProcessException;
import org.geotools.referencing.CRS;
import org.opengis.feature.simple.SimpleFeature;
import org.opengis.feature.simple.SimpleFeatureType;
import org.opengis.feature.type.AttributeDescriptor;
import org.opengis.referencing.FactoryException;
import org.opengis.referencing.crs.CoordinateReferenceSystem;
import org.opengis.referencing.operation.MathTransform;
import org.opengis.referencing.operation.TransformException;

import com.vividsolutions.jts.geom.Geometry;
import com.vividsolutions.jts.geom.Point;

/**
 * Provides generic functions and helper methods to package Features.
 */
class GeoWaveGSUtils {
    
    public static final int NONE_FLAG = 0;
    public static final int HAS_TIME_ATTRIBUTE_FLAG = 1;
    public static final int INTEGER_VALUE_FLAG = 2;
    
    /**
     * Package the specified FeatureCollection in a binary stream.
     * 
     * Layout of the binary stream:
     *  - Number of features (integer).
     *  - Number of measures or values per feature (short).
     *  - Flags (short):
     *      1: The features contain an attribute time.
     *      2: The measures are integers, float by default.
     *      
     *  - NullVal: Null value (integer or float).
     *  - SRID   : EPSG code of the geometries (integer).
     *  - OffsetX: Origin of the X-coordinates of the points (double).
     *  - OffsetY: Origin of the Y-coordinates of the points (double).
     *  - Collection of Features [1-N]:
     *      Relative X or longitude of the point (float).
     *      Relative Y or latitude of the point (float).
     *      Time stamp (Number of milliseconds since January 1, 1970, 00:00:00 GMT), if related flag is set (long).
     *      [1-M] measure[s] or value[s] (integer/float/double, float by default).
     */
    public static byte[] packageFeatures(SimpleFeatureType featureSchema, SimpleFeatureIterator featureIterator, String[] valueAttributeNames, String timeAttribute, boolean compressStream, CoordinateReferenceSystem outputCRS) {
        int packageFlags = INTEGER_VALUE_FLAG;
        
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        DataOutputStream dataStream = new DataOutputStream(outputStream);
        
        // --------------------------------------------------------------------------------
        // Gets attributes to pack.
        
        List<Integer> valueAttributeIndexes = new ArrayList<Integer>();
        int timeAttributeIndex = -1;
        
        for (int i = 0, icount = featureSchema.getAttributeCount(); i < icount; i++) {
            AttributeDescriptor ad = featureSchema.getDescriptor(i);
            String name = ad.getLocalName();
            Class<?> type = ad.getType().getBinding();
            
            if (timeAttributeIndex == -1 && timeAttribute.length() > 0 && Date.class.isAssignableFrom(type) && timeAttribute.compareToIgnoreCase(name) == 0) {
                timeAttributeIndex = i;
                packageFlags |= HAS_TIME_ATTRIBUTE_FLAG;
            }
            if (Number.class.isAssignableFrom(type)) {
                for (String n : valueAttributeNames) {
                    if (n.compareToIgnoreCase(name) == 0) {
                        if (type == Byte.class || type == Short.class || type == Integer.class || type == Long.class) {
                            packageFlags |= INTEGER_VALUE_FLAG;
                        }
                        else {
                            packageFlags &=~INTEGER_VALUE_FLAG;
                        }
                        valueAttributeIndexes.add(i);
                        break;
                    }
                }
            }
        }
        
        // Compute transform to convert input coordinates into output CRS.        
        CoordinateReferenceSystem sourceCRS = featureSchema.getCoordinateReferenceSystem();
        MathTransform mathTransform = null;
        int srid = 0;
        try {
            if (sourceCRS != null && outputCRS != null && !CRS.equalsIgnoreMetadata(sourceCRS, outputCRS)) {
                mathTransform = CRS.findMathTransform(sourceCRS, outputCRS);
            }
            if (sourceCRS != null || outputCRS != null) {
                srid = CRS.lookupEpsgCode(outputCRS != null ? outputCRS : sourceCRS, true);
            }
        }
        catch (FactoryException e) {
            throw new ProcessException(e);
        }
        
        // --------------------------------------------------------------------------------
        // Package Header and Features.
        
        try {
            int featureCount = 0, attributeIndex, attributeCount = valueAttributeIndexes.size();
            double originX = 0, originY = 0;
            Object value = null;
            int nullValue = Integer.MIN_VALUE;
            
            dataStream.writeInt(featureCount);
            dataStream.writeShort(attributeCount);
            dataStream.writeShort(packageFlags);
            if ((packageFlags & INTEGER_VALUE_FLAG) == INTEGER_VALUE_FLAG) {
                dataStream.writeInt(nullValue);
            }
            else {
                dataStream.writeFloat(nullValue);
            }
            dataStream.writeInt(srid);
            
            while (featureIterator.hasNext()) {
                SimpleFeature feature = featureIterator.next();
                
                Geometry geometry = (Geometry)feature.getDefaultGeometry();
                if (geometry == null || geometry.isEmpty()) continue;
                
                Point point = (geometry instanceof Point) ? (Point)geometry : geometry.getCentroid();
                if (mathTransform != null) point = (Point)JTS.transform(point, mathTransform);
                
                // Finalize header of stream.
                if (featureCount == 0) {
                    dataStream.writeDouble(originX = point.getX());
                    dataStream.writeDouble(originY = point.getY());
                }
                
                // Pack each Feature.
                dataStream.writeFloat((float)((point.getX() - originX)));
                dataStream.writeFloat((float)((point.getY() - originY)));
                if (timeAttributeIndex != -1) {
                    value = feature.getAttribute(timeAttributeIndex);
                    dataStream.writeLong(value != null ? ((Date)value).getTime() : 0);
                }
                for (attributeIndex = 0; attributeIndex < attributeCount; attributeIndex++) {
                    value = feature.getAttribute(valueAttributeIndexes.get(attributeIndex));
                    if (value == null) value = nullValue;
                    
                    if ((packageFlags & INTEGER_VALUE_FLAG) == INTEGER_VALUE_FLAG) {
                        Number n = (Number)value;
                        dataStream.writeInt(n.intValue());
                    }
                    else {
                        Number n = (Number)value;
                        dataStream.writeFloat(n.floatValue());
                    }
                }
                featureCount++;
            }
            if (featureCount == 0) {
                dataStream.writeDouble(originX);
                dataStream.writeDouble(originY);
            }
            
            // Fix Feature count in Header.
            byte[] byteArray = outputStream.toByteArray();
            if (featureCount > 0) {
                byteArray[0] = (byte)( (featureCount >>> 24) & 0xFF );
                byteArray[1] = (byte)( (featureCount >>> 16) & 0xFF );
                byteArray[2] = (byte)( (featureCount >>>  8) & 0xFF );
                byteArray[3] = (byte)( (featureCount >>>  0) & 0xFF );
            }
            return compressStream ? compressByteArray(byteArray) : byteArray;
        }
        catch (TransformException e) {
            throw new ProcessException(e);
        }
        catch (IOException e) {
            throw new ProcessException(e);
        }
    }
    
    /**
     * Compress the specified ByteArray.
     */
    private static byte[] compressByteArray(byte[] bytes) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        
        Deflater deflater = new Deflater(Deflater.BEST_COMPRESSION, false);
        deflater.setInput(bytes);
        deflater.finish();
        
        byte[] tmp = new byte[4 * 1024];
        try {
            while (!deflater.finished()) {
                int size = deflater.deflate(tmp);
                baos.write(tmp, 0, size);
            }
        } finally {
            baos.close();
        }
        return baos.toByteArray();
    }
}
