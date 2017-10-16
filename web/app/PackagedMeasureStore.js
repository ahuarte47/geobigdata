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
 * Store to manage Geographical Points with Packaged Measures.
 */
;(function (root, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define([], factory) :
  root.PackagedMeasureStore = factory();
}
(this, function (root, factory) {
  'use strict';

  /**
   * Store to manage Geographical Points with Packaged Measures.
   */
  var PackagedMeasureStore = function (serverUrl, layerName, startTime, finalTime, timeIncrement, options, onLoadFunction) {
    var self = this;
    AbstractMeasureStore.call(self);

    self._currentId = -1;
    self._serverUrl = serverUrl;
    self._layerName = layerName;
    self._mhash = {};
    self._startTime = startTime.getTime();
    self._finalTime = finalTime.getTime();
    self._timeIncrement = timeIncrement;
    var jsworkerUrl = (options && options.workerUrl) || '../app/PackagedMeasureDownloaderWorker.js';

    // Web Worker to fetch data from Packaged Measures.
    self._worker = new Worker(jsworkerUrl);
    self._worker.addEventListener('message', function (event) {
      var data = event.data;
      //console.log('PackagedMeasureDownloaderWorker said: ', data);

      if (data.command == 'get') {
        var record = self._mhash[data.time];
        delete self._mhash[record.time];
        if (record.__error) delete record.__error;
        if (record.__load ) { record.__load(record, data.records); delete record.__load; }
        if (record.onload ) { record.onload(record, data.records); }
      }
    });
    self._worker.addEventListener('error', function (error) {
      if (error.time != null) {
        var record = self._mhash[error.time];
        delete self._mhash[record.time];
        if (record.__load ) delete record.__load;
        if (record.__error) { record.__error(error); delete record.__error; }
        if (record.onerror) { record.onerror(error); }
      }
    });

    if (onLoadFunction) {
      onLoadFunction(self);
    }
  };

  // Make our prototype inherits Parent's methods.
  PackagedMeasureStore.prototype = Object.create(AbstractMeasureStore.prototype);
  PackagedMeasureStore.prototype.constructor = PackagedMeasureStore;

  // Returns if last Record is reached.
  PackagedMeasureStore.prototype.atEnd = function () {
    var self = this;
    return self._currentId >= self._finalTime;
  };
  // Goto first Record.
  PackagedMeasureStore.prototype.first = function () {
    var self = this;
    self._currentId = self._startTime;
    return { 'serverUrl': self._serverUrl, 'layerName': self._layerName, 'time': self._currentId };
  };
  // Move and return to previous Record.
  PackagedMeasureStore.prototype.prev = function () {
    var self = this;
    if (self._currentId <= self._startTime) self._currentId = self._finalTime + self._timeIncrement;
    self._currentId -= self._timeIncrement;
    return { 'serverUrl': self._serverUrl, 'layerName': self._layerName, 'time': self._currentId };
  };
  // Move and return to next Record.
  PackagedMeasureStore.prototype.next = function () {
    var self = this;
    if (self._currentId >= self._finalTime) self._currentId = self._startTime - self._timeIncrement;
    self._currentId += self._timeIncrement;
    return { 'serverUrl': self._serverUrl, 'layerName': self._layerName, 'time': self._currentId };
  };

  // Load Measures of the specified Record.
  PackagedMeasureStore.prototype.load = function (record, srid, bounds, onLoadFunction, onErrorFunction) {
    var self = this;
    self._mhash[record.time] = record;

    record.__load  = onLoadFunction;
    record.__error = onErrorFunction;    
    self._worker.postMessage({ 'serverUrl': record.serverUrl, 'layerName': record.layerName, 'time': record.time, 'srid': srid, 'bounds': bounds });
  };

  return PackagedMeasureStore;
}));
