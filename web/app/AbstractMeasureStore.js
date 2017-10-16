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
 * Abstract Measure Store to manage Geographical Points with sensor Measures.
 */
;(function (root, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define([], factory) :
  root.AbstractMeasureStore = factory();
}
(this, function (root, factory) {
  'use strict';

  /**
   * Abstract Measure Store to manage Geographical Points with sensor Measures.
   */
  var AbstractMeasureStore = function () {
  };

  // Returns if last Record is reached.
  AbstractMeasureStore.prototype.atEnd = function () {
    //
    throw new Error('You must override AbstractMeasureStore::atEnd() method.');
  };
  // Goto first Record.
  AbstractMeasureStore.prototype.first = function () {
    //
    throw new Error('You must override AbstractMeasureStore::first() method.');
  };
  // Move and return to previous Record.
  AbstractMeasureStore.prototype.prev = function () {
    //
    throw new Error('You must override AbstractMeasureStore::prev() method.');
  };
  // Move and return to next Record.
  AbstractMeasureStore.prototype.next = function () {
    //
    throw new Error('You must override AbstractMeasureStore::next() method.');
  };

  // Load Measures of the specified Record.
  AbstractMeasureStore.prototype.load = function (record, onLoadFunction, onErrorFunction) {
    //
    throw new Error('You must override AbstractMeasureStore::load() method.');
  };

  // Calculate some Statistics (Minimum, Maximum, ...) of the Record array using the specified numeric Attribute.
  AbstractMeasureStore.prototype.statisticsOfAttribute = function (records, attributeName) {
    var minimumValue = Number.MAX_VALUE;
    var maximumValue = Number.MIN_VALUE;

    for (var i = 0, icount = records.length; i < icount; i++) {
      var record = records[i];
      var rvalue = record[attributeName];
      minimumValue = Math.min(minimumValue, rvalue);
      maximumValue = Math.max(maximumValue, rvalue);
    }
    return { 'min': minimumValue, 'max': maximumValue };
  };
  // Sort the Record array with the specified Attribute.
  AbstractMeasureStore.prototype.sortByAttribute = function (records, attributeName, sortDecending) {
    if (records == null) return false;

    if (sortDecending) {
      records.sort(function (a, b) {
        var va = a[attributeName];
        var vb = b[attributeName];
        return va == vb ? 0 : (va > vb ? -1 : 1);
      });
    }
    else {
      records.sort(function (a, b) {
        var va = a[attributeName];
        var vb = b[attributeName];
        return va == vb ? 0 : (va < vb ? -1 : 1);
      });
    }
    return true;
  };

  return AbstractMeasureStore;
}));
