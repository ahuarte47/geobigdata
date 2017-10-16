/////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// @author: ahuarte47@yahoo.es
//
/////////////////////////////////////////////////////////////////////////////////
/*
 * Web Worker downloader for Packaged Features.
 */
importScripts('../lib/pako.min.js');

/**
 * WPS 'geowave:PackageFeatureLayer' Template text.
 */
var wpsTemplateText = '<?xml version="1.0" encoding="UTF-8"?>' +
  '<wps:Execute version="1.0.0" service="WPS" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.opengis.net/wps/1.0.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:wps="http://www.opengis.net/wps/1.0.0" xmlns:ows="http://www.opengis.net/ows/1.1" xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" xmlns:wcs="http://www.opengis.net/wcs/1.1.1" xmlns:xlink="http://www.w3.org/1999/xlink" xsi:schemaLocation="http://www.opengis.net/wps/1.0.0 http://schemas.opengis.net/wps/1.0.0/wpsAll.xsd">' +
  '<ows:Identifier>geowave:PackageFeatureLayer</ows:Identifier>' +
    '<wps:DataInputs>' +
      '<wps:Input>' +
        '<ows:Identifier>layerName</ows:Identifier>' +
        '<wps:Data>' + 
          '<wps:LiteralData>%LAYER_NAME%</wps:LiteralData>' +
        '</wps:Data>' +
      '</wps:Input>' +
      '<wps:Input>' +
        '<ows:Identifier>bbox</ows:Identifier>' +
        '<wps:Data>' +
          '<wps:BoundingBoxData crs="%EPSG_CODE%" dimensions="2">' +
            '<ows:LowerCorner>%XMIN% %YMIN%</ows:LowerCorner>' +
            '<ows:UpperCorner>%XMAX% %YMAX%</ows:UpperCorner>' +
          '</wps:BoundingBoxData>' +
        '</wps:Data>' +
      '</wps:Input>' +
      '<wps:Input>' + 
        '<ows:Identifier>filter</ows:Identifier>' +
        '<wps:Data>' +
          '<wps:ComplexData mimeType="text/plain; subtype=cql"><![CDATA[%FILTER_CQL%]]></wps:ComplexData>' +
        '</wps:Data>' +
      '</wps:Input>' + 
      '<wps:Input>' +
        '<ows:Identifier>timeAttribute</ows:Identifier>' +
        '<wps:Data>' + 
          '<wps:LiteralData>%TIME_ATTRIBUTE%</wps:LiteralData>' + 
        '</wps:Data>' +
      '</wps:Input>' +
      '<wps:Input>' +
        '<ows:Identifier>outputAttributes</ows:Identifier>' +
        '<wps:Data>' +
          '<wps:LiteralData>%OUTPUT_ATTRIBUTES%</wps:LiteralData>' + 
        '</wps:Data>' +
      '</wps:Input>' +
    '</wps:DataInputs>' + 
    '<wps:ResponseForm>' + 
      '<wps:RawDataOutput mimeType="application/octet-stream">' +
        '<ows:Identifier>result</ows:Identifier>' +
      '</wps:RawDataOutput>' +
    '</wps:ResponseForm>' +
  '</wps:Execute>';

// Enum of available package flags.
var PACKAGE_FLAGS = {
  NONE_FLAG: 0,
  HAS_TIME_ATTRIBUTE_FLAG: 1,
  INTEGER_VALUE_FLAG: 2
};

// Main event handler.
self.addEventListener('message', function (event) {
  var data = event.data;
  self.postMessage({ 'command': 'start', 'serverUrl': data.serverUrl, 'layerName': data.layerName, 'time': data.time, 'srid': data.srid, 'bounds': data.bounds });

  var ftimeAttribute = 'datetime_begin';
  var valueAttribute = 'effective_value';

  var wpsXml = wpsTemplateText;
  wpsXml = wpsXml.replace("%LAYER_NAME%", data.layerName);
  wpsXml = wpsXml.replace("%EPSG_CODE%", 'EPSG:' + data.srid);
  wpsXml = wpsXml.replace("%XMIN%", data.bounds[0]);
  wpsXml = wpsXml.replace("%YMIN%", data.bounds[1]);
  wpsXml = wpsXml.replace("%XMAX%", data.bounds[2]);
  wpsXml = wpsXml.replace("%YMAX%", data.bounds[3]);
  wpsXml = wpsXml.replace("%FILTER_CQL%", ftimeAttribute + ' = ' + new Date(data.time).toISOString());
  wpsXml = wpsXml.replace("%TIME_ATTRIBUTE%", ftimeAttribute);
  wpsXml = wpsXml.replace("%OUTPUT_ATTRIBUTES%", valueAttribute);

  fetch(data.serverUrl, { 'method': 'POST', 'body': wpsXml }).then(function (response) { return response.blob(); }).then(function (blob) {
    var zip = pako;

    // Read all from internal ZIP content.
    var fileReader = new FileReader();
    fileReader.onload = function () {
      var arrayBuffer = this.result;

      try {
        var records = [];

        var decompressedStream = zip.inflate(arrayBuffer);
        var dataView = new DataView(decompressedStream.buffer);
        var index = 0;

        // Parse Header.
        var featureCount = dataView.getInt32(index);
        index += 4;
        var attribsCount = dataView.getInt16(index);
        index += 2;
        var packageFlags = dataView.getInt16(index);
        index += 2;

        var nullValue = null;
        if ((packageFlags & PACKAGE_FLAGS.INTEGER_VALUE_FLAG) == PACKAGE_FLAGS.INTEGER_VALUE_FLAG) {
          nullValue = dataView.getInt32(index);
          index += 4;
        }
        else {
          nullValue = dataView.getFloat32(index);
          index += 4;
        }
        var srid = dataView.getInt32(index);
        index += 4;
        var originX = dataView.getFloat64(index);
        index += 8;
        var originY = dataView.getFloat64(index);
        index += 8;

        // Parse each feature.
        for (var i = 0, icount = featureCount; i < icount; i++) {
          var coorX = originX + dataView.getFloat32(index); index += 4;
          var coorY = originY + dataView.getFloat32(index); index += 4;
          var value = nullValue;

          if ((packageFlags & PACKAGE_FLAGS.HAS_TIME_ATTRIBUTE_FLAG) == PACKAGE_FLAGS.HAS_TIME_ATTRIBUTE_FLAG) {
            index += 8;
          }
          if (attribsCount > 0) {
            value = dataView.getFloat32(index);
            index += 4 * attribsCount;
          }
          if (value != nullValue) {
            var record = { 'lat': coorY, 'lon': coorX, 'time': data.time };
            record[valueAttribute] = value;
            records.push(record);
          }
        }
        self.postMessage({ 'command': 'get', 'time': data.time, 'records': records });
        self.postMessage({ 'command': 'end' });
        //console.log('done! FeatureCount = ' + featureCount);
      }
      catch (errorMsg) {
        var error = new Error(errorMsg);
        error.time = data.time;
        throw error;
      }
    };
    fileReader.readAsArrayBuffer(blob);
  });
});
