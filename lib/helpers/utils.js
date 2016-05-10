'use strict';

exports.__esModule = true;

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

exports.isPromise = isPromise;
exports.eachComponents = eachComponents;
exports.filterAndFlattenComponents = filterAndFlattenComponents;
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
 * We need to iterate over all components for specified routes.
 * Components array can include objects if named components are used:
 * https://github.com/rackt/react-router/blob/latest/docs/API.md#named-components
 *
 * @param components
 * @param iterator
 */
function eachComponents(components, iterator) {
  var _loop = function _loop(i, l) {
    // eslint-disable-line id-length
    var component = components[i];
    if ((typeof component === 'undefined' ? 'undefined' : (0, _typeof3.default)(component)) === 'object') {
      var keys = (0, _keys2.default)(component);
      keys.forEach(function (key) {
        return iterator(component[key], i, key);
      });
    } else {
      iterator(component, i);
    }
  };

  for (var i = 0, l = components.length; i < l; i++) {
    _loop(i, l);
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

var promiseMapSeries = _promise2.default.mapSeries || function mapSeries(array, iterator) {
  var length = array.length;
  var current = _promise2.default.resolve();
  var results = new Array(length);
  var cb = function cb(arr, index) {
    return function () {
      return iterator(array[index], index, arr);
    };
  };

  for (var i = 0; i < length; ++i) {
    current = results[i] = current.then(cb(array, i));
  }

  return _promise2.default.all(results);
};

/**
 * Function that accepts components with reduxAsyncConnect definitions
 * and loads data
 * @param  {Object} data.components
 * @param  {Function} [data.filter] - filtering function
 * @return {Promise}
 */
function loadAsyncConnect(_ref) {
  var components = _ref.components;
  var _ref$filter = _ref.filter;
  var filter = _ref$filter === undefined ? function () {
    return true;
  } : _ref$filter;
  var rest = (0, _objectWithoutProperties3.default)(_ref, ['components', 'filter']);

  var flattened = filterAndFlattenComponents(components);

  // this allows us to have nested promises, that rely on each other's completion
  // cycle
  return promiseMapSeries(flattened, function (component) {
    var asyncItems = component.reduxAsyncConnect || [];

    return _promise2.default.all(asyncItems.reduce(function (itemsResults, item) {
      if (filter(item, component)) {
        var promiseOrResult = item.promise(rest);

        if (isPromise(promiseOrResult)) {
          promiseOrResult = promiseOrResult.catch(function (error) {
            return { error: error };
          });
        }

        return itemsResults.concat(promiseOrResult);
      }

      return itemsResults;
    }, [])).then(function (results) {
      return results.reduce(function (finalResult, result, idx) {
        var key = asyncItems[idx].key;

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