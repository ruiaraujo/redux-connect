'use strict';

exports.__esModule = true;

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

exports.isPromise = isPromise;
exports.eachComponents = eachComponents;
exports.filterAndFlattenComponents = filterAndFlattenComponents;
exports.filterAndLayerComponents = filterAndLayerComponents;
exports.loadAsyncConnect = loadAsyncConnect;
exports.loadOnServer = loadOnServer;

var _store = require('../store');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Tells us if input looks like promise or not
 * @param  {Mixed} obj
 * @return {Boolean}
 */
function isPromise(obj) {
  return (typeof obj === 'undefined' ? 'undefined' : (0, _typeof3.default)(obj)) === 'object' && obj && obj.then instanceof Function;
}

/**
 * Utility to be able to iterate over array of promises in an async fashion
 * @param  {Array} iterable
 * @param  {Function} iterator
 * @return {Promise}
 */
var mapSeries = Promise.mapSeries || function promiseMapSeries(iterable, iterator) {
  var length = iterable.length;
  var results = new Array(length);
  var i = 0;

  return Promise.resolve().then(function iterateOverResults() {
    return iterator(iterable[i], i, iterable).then(function (result) {
      results[i] = result;
      i += 1;
      if (i < length) {
        return iterateOverResults();
      }

      return results;
    });
  });
};

/**
 * We need to iterate over all components for specified routes.
 * Components array can include objects if named components are used:
 * https://github.com/rackt/react-router/blob/latest/docs/API.md#named-components
 *
 * @param components
 * @param iterator
 */
function eachComponents(components, iterator) {
  var l = components.length;

  var _loop = function _loop(i) {
    var component = components[i];
    if ((typeof component === 'undefined' ? 'undefined' : (0, _typeof3.default)(component)) === 'object') {
      var keys = Object.keys(component);
      keys.forEach(function (key) {
        return iterator(component[key], i, key);
      });
    } else {
      iterator(component, i);
    }
  };

  for (var i = 0; i < l; i += 1) {
    _loop(i);
  }
}

/**
 * Returns flattened array of components that are wrapped with reduxAsyncConnect
 * @param  {Array} components
 * @return {Array}
 */
function filterAndFlattenComponents(components) {
  var flattened = [];
  eachComponents(components, function (component) {
    if (component && component.reduxAsyncConnect) {
      flattened.push(component);
    }
  });
  return flattened;
}

/**
 * Returns an array of an array of components on the same layers that are wrapped
 * with reduxAsyncConnect
 * @param  {Array} components
 * @return {Array}
 */
function filterAndLayerComponents(components) {
  var layered = [];
  var l = components.length;

  var _loop2 = function _loop2(i) {
    var component = components[i];
    if ((typeof component === 'undefined' ? 'undefined' : (0, _typeof3.default)(component)) === 'object') {
      (function () {
        var keys = Object.keys(component);
        var componentLayer = [];
        keys.forEach(function (key) {
          if (component[key] && component[key].reduxAsyncConnect) {
            componentLayer.push(component[key]);
          }
        });
        if (componentLayer.length > 0) {
          layered.push(componentLayer);
        }
      })();
    } else if (component && component.reduxAsyncConnect) {
      layered.push([component]);
    }
  };

  for (var i = 0; i < l; i += 1) {
    _loop2(i);
  }
  return layered;
}

/**
 * Function that accepts components with reduxAsyncConnect definitions
 * and loads data
 * @param  {Object} data.components
 * @param  {Function} [data.filter] - filtering function
 * @return {Promise}
 */
function loadAsyncConnect(_ref) {
  var _ref$components = _ref.components,
      components = _ref$components === undefined ? [] : _ref$components,
      _ref$filter = _ref.filter,
      filter = _ref$filter === undefined ? function () {
    return true;
  } : _ref$filter,
      rest = (0, _objectWithoutProperties3.default)(_ref, ['components', 'filter']);

  var layered = filterAndLayerComponents(components);

  if (layered.length === 0) {
    return Promise.resolve();
  }

  // this allows us to have nested promises, that rely on each other's completion
  // cycle
  return mapSeries(layered, function (componentArr) {
    if (componentArr.length === 0) {
      return Promise.resolve();
    }
    // Collect the results of each component on current layer.
    var results = [];
    var asyncItemsArr = [];

    var _loop3 = function _loop3(i) {
      var component = componentArr[i];
      var asyncItems = component.reduxAsyncConnect;
      asyncItemsArr.push.apply(asyncItemsArr, asyncItems);

      // get array of results
      results.push.apply(results, asyncItems.reduce(function (itemsResults, item) {
        if (filter(item, component)) {
          var promiseOrResult = item.promise(rest);

          if (isPromise(promiseOrResult)) {
            promiseOrResult = promiseOrResult.catch(function (error) {
              return { error: error };
            });
          }

          itemsResults.push(promiseOrResult);
        }

        return itemsResults;
      }, []));
    };

    for (var i = 0; i < componentArr.length; i += 1) {
      _loop3(i);
    }

    return Promise.all(results).then(function (finalResults) {
      return finalResults.reduce(function (finalResult, result, idx) {
        var key = asyncItemsArr[idx].key;

        if (key) {
          finalResult[key] = result;
        }

        return finalResult;
      }, {});
    });
  });
}

/**
 * Helper to load data on server
 * @param  {Mixed} args
 * @return {Promise}
 */
function loadOnServer(args) {
  return loadAsyncConnect(args).then(function () {
    args.store.dispatch((0, _store.endGlobalLoad)());
  });
}