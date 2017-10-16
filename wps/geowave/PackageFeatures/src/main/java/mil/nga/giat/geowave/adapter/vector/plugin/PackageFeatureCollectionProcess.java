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

import org.geoserver.wps.process.AbstractRawData;
import org.geoserver.wps.process.ByteArrayRawData;
import org.geoserver.wps.process.RawData;

import org.geotools.data.simple.SimpleFeatureCollection;
import org.geotools.data.simple.SimpleFeatureIterator;
import org.geotools.process.ProcessException;
import org.geotools.process.factory.DescribeParameter;
import org.geotools.process.factory.DescribeProcess;
import org.geotools.process.factory.DescribeResult;

import org.opengis.feature.simple.SimpleFeatureType;

/**
 * This process packages a Feature collection in a binary stream
 * to return tons of xy-time-measures records.
 * 
 * It will use the centroid for other geometry types than point.
 * GeoWaveGSUtils describes the layout of the binary stream.    
 */
@DescribeProcess(
    title = "PackageFeatureCollection",
    description = "This process will package a Feature collection in a binary stream. It will use the centroid for other geometry types than point"
    )
public class PackageFeatureCollectionProcess {
    
	@DescribeResult(name = "result", description = "Package of the Feature collection", meta = { "mimeTypes=application/octet-stream" })
	public RawData execute(
	    @DescribeParameter(name = "data", description = "Input Feature collection")
	    SimpleFeatureCollection featureCollection,
	    
        @DescribeParameter(name = "timeAttribute", description = "Time Attribute to pack", min = 0, max = 1, defaultValue = "")
        String timeAttribute,
        @DescribeParameter(name = "outputAttributes", description = "Separated-comma array of numeric Attributes to pack", min = 0, max = 1, defaultValue = "")
        String outputAttributes
	    )
	    throws ProcessException {
	    
        SimpleFeatureType featureSchema = featureCollection.getSchema();
        String[] valueAttributeNames = outputAttributes != null ? outputAttributes.split(",") : new String[0];
        if (timeAttribute == null) timeAttribute = "";
        
	    // Pack Features.
	    SimpleFeatureIterator featureIterator = featureCollection.features();
	    try {
	        byte[] byteArray = GeoWaveGSUtils.packageFeatures(featureSchema, featureIterator, valueAttributeNames, timeAttribute, true, null);
	        return new ByteArrayRawData(byteArray, AbstractRawData.BINARY_MIME);
	    }
	    finally {
	        featureIterator.close();
	    }
	}
}
