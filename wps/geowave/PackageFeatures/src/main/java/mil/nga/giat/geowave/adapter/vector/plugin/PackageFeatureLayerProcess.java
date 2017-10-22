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

import java.io.IOException;

import org.geoserver.catalog.Catalog;
import org.geoserver.catalog.FeatureTypeInfo;
import org.geoserver.platform.GeoServerExtensions;
import org.geoserver.wps.process.AbstractRawData;
import org.geoserver.wps.process.ByteArrayRawData;
import org.geoserver.wps.process.RawData;

import org.geotools.data.simple.SimpleFeatureIterator;
import org.geotools.data.simple.SimpleFeatureSource;
import org.geotools.factory.CommonFactoryFinder;
import org.geotools.geometry.jts.JTS;
import org.geotools.geometry.jts.ReferencedEnvelope;
import org.geotools.process.ProcessException;
import org.geotools.process.factory.DescribeParameter;
import org.geotools.process.factory.DescribeProcess;
import org.geotools.process.factory.DescribeResult;
import org.geotools.referencing.CRS;

import org.opengis.feature.simple.SimpleFeatureType;
import org.opengis.filter.Filter;
import org.opengis.filter.FilterFactory2;
import org.opengis.referencing.FactoryException;
import org.opengis.referencing.crs.CoordinateReferenceSystem;
import org.opengis.referencing.operation.MathTransform;
import org.opengis.referencing.operation.TransformException;

/**
 * This process packages a FeatureLayer in a binary stream
 * to return tons of xy-time-measures records.
 * 
 * It will use the centroid for other geometry types than point.
 * GeoWaveGSUtils describes the layout of the binary stream.    
 */
@DescribeProcess(
    title = "PackageFeatureLayer",
    description = "This process will package a FeatureLayer in a binary stream. It will use the centroid for other geometry types than point"
    )
public class PackageFeatureLayerProcess {
    
    // Default FilterFactory to use.
    static final FilterFactory2 FF = CommonFactoryFinder.getFilterFactory2();
    
    @DescribeResult(name = "result", description = "Package of the Feature collection", meta = { "mimeTypes=application/octet-stream" })
    public RawData execute(
        @DescribeParameter(name = "layerName", description = "Input FeatureLayer name")
        String featureLayerName,
        
        @DescribeParameter(name = "bbox", description = "Georeferenced bounding box of the output")
        ReferencedEnvelope envelope,
        @DescribeParameter(name = "filter", description = "Optional filter to apply to the output", min = 0, max = 1)
        Filter filter,
        
        @DescribeParameter(name = "timeAttribute", description = "Time Attribute to pack", min = 0, max = 1, defaultValue = "")
        String timeAttribute,
        @DescribeParameter(name = "outputAttributes", description = "Separated-comma array of numeric Attributes to pack", min = 0, max = 1, defaultValue = "")
        String outputAttributes
        )
        throws ProcessException, IOException {
        
        Catalog catalog = (Catalog)GeoServerExtensions.bean("catalog");
        if (catalog == null)
            throw new ProcessException("Not found any catalog!");
        
        FeatureTypeInfo featureTypeInfo = catalog.getFeatureTypeByName(featureLayerName);
        if (featureTypeInfo == null)
            throw new ProcessException("Layer '"+ featureLayerName +"' not found in current catalog!");
	    
        SimpleFeatureSource featureSource = (SimpleFeatureSource)featureTypeInfo.getFeatureSource(null, null);
        SimpleFeatureType featureSchema = featureSource.getSchema();
        String[] valueAttributeNames = outputAttributes != null ? outputAttributes.split(",") : new String[0];
        if (timeAttribute == null) timeAttribute = "";
        if (envelope == null) envelope = new ReferencedEnvelope();
        if (filter == null) filter = Filter.INCLUDE;
        
        // --------------------------------------------------------------------------------
        // Gets the Filter to fetch the Features that INTERSETCS with the Envelope.

        CoordinateReferenceSystem sourceCRS = featureSchema.getCoordinateReferenceSystem();
        CoordinateReferenceSystem targetCRS = envelope.getCoordinateReferenceSystem();
        
        try {
            MathTransform mathTransform = null;
            
            if (sourceCRS != null && targetCRS != null && !CRS.equalsIgnoreMetadata(sourceCRS, targetCRS)) {
                mathTransform = CRS.findMathTransform(targetCRS, sourceCRS);
                envelope = new ReferencedEnvelope(JTS.transform(envelope, mathTransform), sourceCRS);
            }
            if (!envelope.isNull() && !envelope.isEmpty()) {
                Filter spatialFilter = FF.bbox(FF.property(featureSchema.getGeometryDescriptor().getLocalName()), envelope);
                filter = filter.equals(Filter.INCLUDE) ? spatialFilter : FF.and(spatialFilter, filter);
            }
        }
        catch (TransformException e) {
            throw new ProcessException(e);
        }
        catch (FactoryException e) {
            throw new ProcessException(e);
        }
        
        // --------------------------------------------------------------------------------
        // Pack Features.
        
        SimpleFeatureIterator featureIterator = featureSource.getFeatures(filter).features();
        try {
            byte[] byteArray = GeoWaveGSUtils.packageFeatures(featureSchema, featureIterator, valueAttributeNames, timeAttribute, true, targetCRS);
            return new ByteArrayRawData(byteArray, AbstractRawData.BINARY_MIME);
        }
        finally {
            featureIterator.close();
        }
    }
}
