(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

var minified = require('./vendor/minified');
var ClayConfig = require('./lib/clay-config');

var $ = minified.$;
var _ = minified._;

var config = _.extend([], window.clayConfig || []);
var settings = _.extend({}, window.claySettings || {});
var returnTo = window.returnTo || 'pebblejs://close#';
var customFn = window.customFn || function() {};
var clayComponents = window.clayComponents || {};
var clayMeta = window.clayMeta || {};

var platform = window.navigator.userAgent.match(/android/i) ? 'android' : 'ios';
document.documentElement.classList.add('platform-' + platform);

// Register the passed components
_.eachObj(clayComponents, function(key, component) {
  ClayConfig.registerComponent(component);
});

var $mainForm = $('#main-form');
var clayConfig = new ClayConfig(settings, config, $mainForm, clayMeta);

// add listeners here
$mainForm.on('submit', function() {
  // Set the return URL depending on the runtime environment
  location.href = returnTo +
                  encodeURIComponent(JSON.stringify(clayConfig.serialize()));
});

// Run the custom function in the context of the ClayConfig
customFn.call(clayConfig, minified);

// Now that we have given the dev's custom code to run and attach listeners,
// we build the config
clayConfig.build();

},{"./lib/clay-config":2,"./vendor/minified":8}],2:[function(require,module,exports){
'use strict';

/**
 * A Clay config Item
 * @typedef {Object} Clay~ConfigItem
 * @property {string} type
 * @property {string|boolean|number} defaultValue
 * @property {string} [messageKey]
 * @property {string} [id]
 * @property {string} [label]
 * @property {Object} [attributes]
 * @property {Array} [options]
 * @property {Array} [items]
 * @property {Array} [capabilities]
 */

var HTML = require('../vendor/minified').HTML;
var _ = require('../vendor/minified')._;
var ClayItem = require('./clay-item');
var utils = require('../lib/utils');
var ClayEvents = require('./clay-events');
var componentStore = require('./component-registry');
var manipulators = require('./manipulators');

/**
 * @extends ClayEvents
 * @param {Object} settings - setting that were set from a previous session
 * @param {Array|Object} config
 * @param {M} $rootContainer
 * @param {Object} meta
 * @constructor
 */
function ClayConfig(settings, config, $rootContainer, meta) {
  var self = this;

  var _settings = _.copyObj(settings);
  var _items;
  var _itemsById;
  var _itemsByMessageKey;
  var _isBuilt;

  /**
   * Initialize the item arrays and objects
   * @private
   * @return {void}
   */
  function _initializeItems() {
    _items = [];
    _itemsById = {};
    _itemsByMessageKey = {};
    _isBuilt = false;
  }

  /**
   * Add item(s) to the config
   * @param {Clay~ConfigItem|Array} item
   * @param {M} $container
   * @return {void}
   */
  function _addItems(item, $container) {
    if (Array.isArray(item)) {
      item.forEach(function(item) {
        _addItems(item, $container);
      });
    } else if (utils.includesCapability(meta.activeWatchInfo, item.capabilities)) {
      if (item.type === 'section') {
        var $wrapper = HTML('<div class="section">');
        $container.add($wrapper);
        _addItems(item.items, $wrapper);
      } else {
        var _item = _.copyObj(item);
        _item.clayId = _items.length;

        var clayItem = new ClayItem(_item).initialize(self);

        if (_item.id) {
          _itemsById[_item.id] = clayItem;
        }

        if (_item.messageKey) {
          _itemsByMessageKey[_item.messageKey] = clayItem;
        }

        _items.push(clayItem);

        // set the value of the item via the manipulator to ensure consistency
        var value;
        //If localStorage contains an entry for the items messageKey
        if (typeof _settings[_item.messageKey] !== 'undefined') {
          value = _settings[_item.messageKey];
        } 
        //If localStorage contains an entry for the items id
        else if (typeof _settings[_item.id] !== 'undefined') {
          value = _settings[_item.id];
        } 
        //just set the defaultValue from the config file
        else {
          value = _item.defaultValue;
        }

        //Set value of item
        clayItem.set(typeof value !== 'undefined' ? value : '');

        $container.add(clayItem.$element);
      }
    }
  }

  /**
   * Throws if the config has not been built yet.
   * @param {string} fnName
   * @returns {boolean}
   * @private
   */
  function _checkBuilt(fnName) {
    if (!_isBuilt) {
      throw new Error(
        'ClayConfig not built. build() must be run before ' +
        'you can run ' + fnName + '()'
      );
    }
    return true;
  }

  self.meta = meta;
  self.$rootContainer = $rootContainer;

  self.EVENTS = {
    /**
     * Called before framework has initialized. This is when you would attach your
     * custom components.
     * @const
     */
    BEFORE_BUILD: 'BEFORE_BUILD',

    /**
     * Called after the config has been parsed and all components have their initial
     * value set
     * @const
     */
    AFTER_BUILD: 'AFTER_BUILD',

    /**
     * Called if .build() is executed after the page has already been built and
     * before the existing content is destroyed
     * @const
     */
    BEFORE_DESTROY: 'BEFORE_DESTROY',

    /**
     * Called if .build() is executed after the page has already been built and after
     * the existing content is destroyed
     * @const
     */
    AFTER_DESTROY: 'AFTER_DESTROY'
  };
  utils.updateProperties(self.EVENTS, {writable: false});

  /**
   * @returns {Array.<ClayItem>}
   */
  self.getAllItems = function() {
    _checkBuilt('getAllItems');
    return _items;
  };

  /**
   * @param {string} messageKey
   * @returns {ClayItem}
   */
  self.getItemByMessageKey = function(messageKey) {
    _checkBuilt('getItemByMessageKey');
    return _itemsByMessageKey[messageKey];
  };

  /**
   * @param {string} id
   * @returns {ClayItem}
   */
  self.getItemById = function(id) {
    _checkBuilt('getItemById');
    return _itemsById[id];
  };

  /**
   * @param {string} type
   * @returns {Array.<ClayItem>}
   */
  self.getItemsByType = function(type) {
    _checkBuilt('getItemsByType');
    return _items.filter(function(item) {
      return item.config.type === type;
    });
  };

  /**
   * @param {string} group
   * @returns {Array.<ClayItem>}
   */
  self.getItemsByGroup = function(group) {
    _checkBuilt('getItemsByGroup');
    return _items.filter(function(item) {
      return item.config.group === group;
    });
  };

  /**
   * @returns {Object}
   */
  self.serialize = function() {
    _checkBuilt('serialize');

    _settings = {};

    _.eachObj(_itemsByMessageKey, function(messageKey, item) {
      _settings[messageKey] = {
        value: item.get()
      };

      if (item.precision) {
        _settings[messageKey].precision = item.precision;
      }
    });
    return _settings;
  };

  // @todo maybe don't do this and force the static method
  self.registerComponent = ClayConfig.registerComponent;

  /**
   * Empties the root container
   * @returns {ClayConfig}
   */
  self.destroy = function() {
    var el = $rootContainer[0];
    self.trigger(self.EVENTS.BEFORE_DESTROY);
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
    _initializeItems();
    self.trigger(self.EVENTS.AFTER_DESTROY);
    return self;
  };

  /**
   * Build the config page. This must be run before any of the get methods can be run
   * If you call this method after the page has already been built, teh page will be
   * destroyed and built again.
   * @returns {ClayConfig}
   */
  self.build = function() {
    if (_isBuilt) {
      self.destroy();
    }
    self.trigger(self.EVENTS.BEFORE_BUILD);
    _addItems(self.config, $rootContainer);
    _isBuilt = true;
    self.trigger(self.EVENTS.AFTER_BUILD);
    return self;
  };

  _initializeItems();

  // attach event methods
  ClayEvents.call(self, $rootContainer);

  // prevent external modifications of properties
  utils.updateProperties(self, { writable: false, configurable: false });

  // expose the config to allow developers to update it before the build is run
  self.config = config;
}

/**
 * Register a component to Clay. This must be called prior to .build();
 * @param {Object} component - the clay component to register
 * @param {string} component.name - the name of the component
 * @param {string} component.template - HTML template to use for the component
 * @param {string|Object} component.manipulator - methods to attach to the component
 * @param {function} component.manipulator.set - set manipulator method
 * @param {function} component.manipulator.get - get manipulator method
 * @param {Object} [component.defaults] - template defaults
 * @param {function} [component.initialize] - method to scaffold the component
 * @return {boolean} - Returns true if component was registered correctly
 */
ClayConfig.registerComponent = function(component) {
  var _component = _.copyObj(component);

  if (componentStore[_component.name]) {
    console.warn('Component: ' + _component.name +
                 ' is already registered. If you wish to override the existing' +
                 ' functionality, you must provide a new name');
    return false;
  }

  if (typeof _component.manipulator === 'string') {
    _component.manipulator = manipulators[component.manipulator];

    if (!_component.manipulator) {
      throw new Error('The manipulator: ' + component.manipulator +
                      ' does not exist in the built-in manipulators.');
    }
  }

  if (!_component.manipulator) {
    throw new Error('The manipulator must be defined');
  }

  if (typeof _component.manipulator.set !== 'function' ||
      typeof _component.manipulator.get !== 'function') {
    throw new Error('The manipulator must have both a `get` and `set` method');
  }

  if (_component.style) {
    var style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(_component.style));
    document.head.appendChild(style);
  }

  componentStore[_component.name] = _component;
  return true;
};

module.exports = ClayConfig;

},{"../lib/utils":7,"../vendor/minified":8,"./clay-events":3,"./clay-item":4,"./component-registry":5,"./manipulators":6}],3:[function(require,module,exports){
'use strict';

var $ = require('../vendor/minified').$;
var _ = require('../vendor/minified')._;

/**
 * Attaches event methods to the context.
 * Call with ClayEvents.call(yourObject, $eventTarget)
 * @param {EventEmitter|M} $eventTarget - An object that will be used as the event
 * target. Must implement EventEmitter
 * @constructor
 */
function ClayEvents($eventTarget) {
  var self = this;
  var _eventProxies = [];

  /**
   * prefixes events with "|"
   * @param {string} events
   * @returns {string}
   * @private
   */
  function _transformEventNames(events) {
    return events.split(' ').map(function(event) {
      return '|' + event.replace(/^\|/, '');
    }).join(' ');
  }

  /**
   * @param {function} handler
   * @param {function} proxy
   * @returns {function}
   * @private
   */
  function _registerEventProxy(handler, proxy) {
    var eventProxy = _.find(_eventProxies, function(item) {
      return item.handler === handler ? item : null;
    });

    if (!eventProxy) {
      eventProxy = { handler: handler, proxy: proxy };
      _eventProxies.push(eventProxy);
    }
    return eventProxy.proxy;
  }

  /**
   * @param {function} handler
   * @returns {function}
   * @private
   */
  function _getEventProxy(handler) {
    return _.find(_eventProxies, function(item) {
      return item.handler === handler ? item.proxy : null;
    });
  }

  /**
   * Attach an event listener to the item.
   * @param {string} events - a space separated list of events
   * @param {function} handler
   * @returns {ClayEvents}
   */
  self.on = function(events, handler) {
    var _events = _transformEventNames(events);
    var self = this;
    var _proxy = _registerEventProxy(handler, function() {
      handler.apply(self, arguments);
    });
    $eventTarget.on(_events, _proxy);
    return self;
  };

  /**
   * Remove the given event handler. NOTE: This will remove the handler from all
   * registered events
   * @param {function} handler
   * @returns {ClayEvents}
   */
  self.off = function(handler) {
    var _proxy = _getEventProxy(handler);
    if (_proxy) {
      $.off(_proxy);
    }
    return self;
  };

  /**
   * Trigger an event.
   * @param {string} name - a single event name to trigger
   * @param {Object} [eventObj] - an object to pass to the event handler,
   * provided the handler does not have custom arguments.
   * @returns {ClayEvents}
   */
  self.trigger = function(name, eventObj) {
    $eventTarget.trigger(name, eventObj);
    return self;
  };
}

module.exports = ClayEvents;

},{"../vendor/minified":8}],4:[function(require,module,exports){
'use strict';

var componentRegistry = require('./component-registry');
var minified = require('../vendor/minified');
var utils = require('../lib/utils');
var ClayEvents = require('./clay-events');

var _ = minified._;
var HTML = minified.HTML;

/**
 * @extends ClayEvents
 * @param {Clay~ConfigItem} config
 * @constructor
 */
function ClayItem(config) {
  var self = this;

  var _component = componentRegistry[config.type];

  if (!_component) {
    throw new Error('The component: ' + config.type + ' is not registered. ' +
                    'Make sure to register it with ClayConfig.registerComponent()');
  }

  var _templateData = _.extend({}, _component.defaults || {}, config);

  /** @type {string|null} */
  self.id = config.id || null;

  /** @type {string|null} */
  self.messageKey = config.messageKey || null;

  /** @type {Object} */
  self.config = config;

  /** @type {M} */
  self.$element = HTML(_component.template.trim(), _templateData);

  /** @type {M} */
  self.$manipulatorTarget = self.$element.select('[data-manipulator-target]');

  // this caters for situations where the manipulator target is the root element
  if (!self.$manipulatorTarget.length) {
    self.$manipulatorTarget = self.$element;
  }

  /**
   * Run the initializer if it exists and attaches the css to the head.
   * Passes minified as the first param
   * @param {ClayConfig} clay
   * @returns {ClayItem}
   */
  self.initialize = function(clay) {
    if (typeof _component.initialize === 'function') {
      _component.initialize.call(self, minified, clay);
    }
    return self;
  };

  // attach event methods
  ClayEvents.call(self, self.$manipulatorTarget);

  // attach the manipulator methods to the clayItem
  _.eachObj(_component.manipulator, function(methodName, method) {
    self[methodName] = method.bind(self);
  });

  // prevent external modifications of properties
  utils.updateProperties(self, { writable: false, configurable: false });
}

module.exports = ClayItem;

},{"../lib/utils":7,"../vendor/minified":8,"./clay-events":3,"./component-registry":5}],5:[function(require,module,exports){
'use strict';

// module is blank because we dynamically add components
module.exports = {};

},{}],6:[function(require,module,exports){
'use strict';

var _ = require('../vendor/minified')._;

/**
 * @returns {ClayItem|ClayEvents}
 * @extends {ClayItem}
 */
function disable() {
  if (this.$manipulatorTarget.get('disabled')) { return this; }
  this.$element.set('+disabled');
  this.$manipulatorTarget.set('disabled', true);
  return this.trigger('disabled');
}

/**
 * @returns {ClayItem|ClayEvents}
 * @extends {ClayItem}
 */
function enable() {
  if (!this.$manipulatorTarget.get('disabled')) { return this; }
  this.$element.set('-disabled');
  this.$manipulatorTarget.set('disabled', false);
  return this.trigger('enabled');
}

/**
 * @returns {ClayItem|ClayEvents}
 * @extends {ClayItem}
 */
function hide() {
  if (this.$element[0].classList.contains('hide')) { return this; }
  this.$element.set('+hide');
  return this.trigger('hide');
}

/**
 * @returns {ClayItem|ClayEvents}
 * @extends {ClayItem}
 */
function show() {
  if (!this.$element[0].classList.contains('hide')) { return this; }
  this.$element.set('-hide');
  return this.trigger('show');
}

module.exports = {
  html: {
    get: function() {
      return this.$manipulatorTarget.get('innerHTML');
    },
    set: function(value) {
      if (this.get() === value.toString(10)) { return this; }
      this.$manipulatorTarget.set('innerHTML', value);
      return this.trigger('change');
    },
    hide: hide,
    show: show
  },
  button: {
    get: function() {
      return this.$manipulatorTarget.get('innerHTML');
    },
    set: function(value) {
      if (this.get() === value.toString(10)) { return this; }
      this.$manipulatorTarget.set('innerHTML', value);
      return this.trigger('change');
    },
    disable: disable,
    enable: enable,
    hide: hide,
    show: show
  },
  val: {
    get: function() {
      return this.$manipulatorTarget.get('value');
    },
    set: function(value) {
      if (this.get() === value.toString(10)) { return this; }
      this.$manipulatorTarget.set('value', value);
      return this.trigger('change');
    },
    disable: disable,
    enable: enable,
    hide: hide,
    show: show
  },
  slider: {
    get: function() {
      return parseFloat(this.$manipulatorTarget.get('value'));
    },
    set: function(value) {
      var initVal = this.get();
      this.$manipulatorTarget.set('value', value);
      if (this.get() === initVal) { return this; }
      return this.trigger('change');
    },
    disable: disable,
    enable: enable,
    hide: hide,
    show: show
  },
  checked: {
    get: function() {
      return this.$manipulatorTarget.get('checked');
    },
    set: function(value) {
      if (!this.get() === !value) { return this; }
      this.$manipulatorTarget.set('checked', !!value);
      return this.trigger('change');
    },
    disable: disable,
    enable: enable,
    hide: hide,
    show: show
  },
  radiogroup: {
    get: function() {
      return this.$element.select('input:checked').get('value');
    },
    set: function(value) {
      if (this.get() === value.toString(10)) { return this; }
      this.$element
        .select('input[value="' + value.replace('"', '\\"') + '"]')
        .set('checked', true);
      return this.trigger('change');
    },
    disable: disable,
    enable: enable,
    hide: hide,
    show: show
  },
  checkboxgroup: {
    get: function() {
      var result = [];
      this.$element.select('input').each(function(item) {
        result.push(!!item.checked);
      });
      return result;
    },
    set: function(values) {
      var self = this;
      values = Array.isArray(values) ? values : [];

      while (values.length < this.get().length) {
        values.push(false);
      }

      if (_.equals(this.get(), values)) { return this; }

      self.$element.select('input')
        .set('checked', false)
        .each(function(item, index) {
          item.checked = !!values[index];
        });

      return self.trigger('change');
    },
    disable: disable,
    enable: enable,
    hide: hide,
    show: show
  },
  color: {
    get: function() {
      return parseInt(this.$manipulatorTarget.get('value'), 10) || 0;
    },
    set: function(value) {
      value = this.roundColorToLayout(value || 0);

      if (this.get() === value) { return this; }
      this.$manipulatorTarget.set('value', value);
      return this.trigger('change');
    },
    disable: disable,
    enable: enable,
    hide: hide,
    show: show
  }
};

},{"../vendor/minified":8}],7:[function(require,module,exports){
'use strict';

/**
 * Batch update all the properties of an object.
 * @param {Object} obj
 * @param {Object} descriptor
 * @param {boolean} [descriptor.configurable]
 * @param {boolean} [descriptor.enumerable]
 * @param {*} [descriptor.value]
 * @param {boolean} [descriptor.writable]
 * @param {function} [descriptor.get]
 * @param {function} [descriptor.set]
 * @return {void}
 */
module.exports.updateProperties = function(obj, descriptor) {
  Object.getOwnPropertyNames(obj).forEach(function(prop) {
    Object.defineProperty(obj, prop, descriptor);
  });
};

module.exports.capabilityMap = {
  PLATFORM_APLITE: {
    platforms: ['aplite'],
    minFwMajor: 0,
    minFwMinor: 0
  },
  PLATFORM_BASALT: {
    platforms: ['basalt'],
    minFwMajor: 0,
    minFwMinor: 0
  },
  PLATFORM_CHALK: {
    platforms: ['chalk'],
    minFwMajor: 0,
    minFwMinor: 0
  },
  PLATFORM_DIORITE: {
    platforms: ['diorite'],
    minFwMajor: 0,
    minFwMinor: 0
  },
  PLATFORM_EMERY: {
    platforms: ['emery'],
    minFwMajor: 0,
    minFwMinor: 0
  },
  BW: {
    platforms: ['aplite', 'diorite'],
    minFwMajor: 0,
    minFwMinor: 0
  },
  COLOR: {
    platforms: ['basalt', 'chalk', 'emery'],
    minFwMajor: 0,
    minFwMinor: 0
  },
  MICROPHONE: {
    platforms: ['basalt', 'chalk', 'diorite', 'emery'],
    minFwMajor: 0,
    minFwMinor: 0
  },
  SMARTSTRAP: {
    platforms: ['basalt', 'chalk', 'diorite', 'emery'],
    minFwMajor: 3,
    minFwMinor: 4
  },
  SMARTSTRAP_POWER: {
    platforms: ['basalt', 'chalk', 'emery'],
    minFwMajor: 3,
    minFwMinor: 4
  },
  HEALTH: {
    platforms: ['basalt', 'chalk', 'diorite', 'emery'],
    minFwMajor: 3,
    minFwMinor: 10
  },
  RECT: {
    platforms: ['aplite', 'basalt', 'diorite', 'emery'],
    minFwMajor: 0,
    minFwMinor: 0
  },
  ROUND: {
    platforms: ['chalk'],
    minFwMajor: 0,
    minFwMinor: 0
  },
  DISPLAY_144x168: {
    platforms: ['aplite', 'basalt', 'diorite'],
    minFwMajor: 0,
    minFwMinor: 0
  },
  DISPLAY_180x180_ROUND: {
    platforms: ['chalk'],
    minFwMajor: 0,
    minFwMinor: 0
  },
  DISPLAY_200x228: {
    platforms: ['emery'],
    minFwMajor: 0,
    minFwMinor: 0
  }
};

/**
 * Checks if all of the provided capabilities are compatible with the watch
 * @param {Object} activeWatchInfo
 * @param {Array<string>} [capabilities]
 * @return {boolean}
 */
module.exports.includesCapability = function(activeWatchInfo, capabilities) {
  var notRegex = /^NOT_/;
  var result = [];

  if (!capabilities || !capabilities.length) {
    return true;
  }

  for (var i = capabilities.length - 1; i >= 0; i--) {
    var capability = capabilities[i];
    var mapping = module.exports.capabilityMap[capability.replace(notRegex, '')];

    if (!mapping ||
        mapping.platforms.indexOf(activeWatchInfo.platform) === -1 ||
        mapping.minFwMajor > activeWatchInfo.firmware.major ||
        mapping.minFwMajor === activeWatchInfo.firmware.major &&
        mapping.minFwMinor > activeWatchInfo.firmware.minor
    ) {
      result.push(!!capability.match(notRegex));
    } else {
      result.push(!capability.match(notRegex));
    }
  }

  return result.indexOf(false) === -1;
};

},{}],8:[function(require,module,exports){
module.exports = function () {
    var _window = window;
    var MINIFIED_MAGIC_NODEID = 'Nia';
    var MINIFIED_MAGIC_PREV = 'NiaP';
    var setter = {}, getter = {};
    var idSequence = 1;
    var DOMREADY_HANDLER = /^[ic]/.test(document['readyState']) ? _null : [];
    var _null = null;
    var undef;
    function val3(v) {
        return v.substr(0, 3);
    }
    var MONTH_LONG_NAMES = split('January,February,March,April,May,June,July,August,September,October,November,December', /,/g);
    var MONTH_SHORT_NAMES = map(MONTH_LONG_NAMES, val3);
    var WEEK_LONG_NAMES = split('Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday', /,/g);
    var WEEK_SHORT_NAMES = map(WEEK_LONG_NAMES, val3);
    var MERIDIAN_NAMES = split('am,pm', /,/g);
    var MERIDIAN_NAMES_FULL = split('am,am,am,am,am,am,am,am,am,am,am,am,pm,pm,pm,pm,pm,pm,pm,pm,pm,pm,pm,pm', /,/g);
    var FORMAT_DATE_MAP = {
        'y': [
            'FullYear',
            nonOp
        ],
        'Y': [
            'FullYear',
            function (d) {
                return d % 100;
            }
        ],
        'M': [
            'Month',
            plusOne
        ],
        'n': [
            'Month',
            MONTH_SHORT_NAMES
        ],
        'N': [
            'Month',
            MONTH_LONG_NAMES
        ],
        'd': [
            'Date',
            nonOp
        ],
        'm': [
            'Minutes',
            nonOp
        ],
        'H': [
            'Hours',
            nonOp
        ],
        'h': [
            'Hours',
            function (d) {
                return d % 12 || 12;
            }
        ],
        'k': [
            'Hours',
            plusOne
        ],
        'K': [
            'Hours',
            function (d) {
                return d % 12;
            }
        ],
        's': [
            'Seconds',
            nonOp
        ],
        'S': [
            'Milliseconds',
            nonOp
        ],
        'a': [
            'Hours',
            MERIDIAN_NAMES_FULL
        ],
        'w': [
            'Day',
            WEEK_SHORT_NAMES
        ],
        'W': [
            'Day',
            WEEK_LONG_NAMES
        ],
        'z': [
            'TimezoneOffset',
            function (d, dummy, timezone) {
                if (timezone)
                    return timezone;
                var sign = d > 0 ? '-' : '+';
                var off = d < 0 ? -d : d;
                return sign + pad(2, Math.floor(off / 60)) + pad(2, off % 60);
            }
        ]
    };
    var PARSE_DATE_MAP = {
        'y': 0,
        'Y': [
            0,
            -2000
        ],
        'M': [
            1,
            1
        ],
        'n': [
            1,
            MONTH_SHORT_NAMES
        ],
        'N': [
            1,
            MONTH_LONG_NAMES
        ],
        'd': 2,
        'm': 4,
        'H': 3,
        'h': 3,
        'K': [
            3,
            1
        ],
        'k': [
            3,
            1
        ],
        's': 5,
        'S': 6,
        'a': [
            3,
            MERIDIAN_NAMES
        ]
    };
    var MAX_CACHED_TEMPLATES = 99;
    var templateCache = {};
    var templates = [];
    function toString(s) {
        return s != _null ? '' + s : '';
    }
    function isType(s, o) {
        return typeof s == o;
    }
    function isString(s) {
        return isType(s, 'string');
    }
    function isObject(f) {
        return !!f && isType(f, 'object');
    }
    function isNode(n) {
        return n && n['nodeType'];
    }
    function isNumber(n) {
        return isType(n, 'number');
    }
    function isDate(n) {
        return isObject(n) && !!n['getDay'];
    }
    function isBool(n) {
        return n === true || n === false;
    }
    function isValue(n) {
        var type = typeof n;
        return type == 'object' ? !!(n && n['getDay']) : type == 'string' || type == 'number' || isBool(n);
    }
    function nonOp(v) {
        return v;
    }
    function plusOne(d) {
        return d + 1;
    }
    function replace(s, regexp, sub) {
        return toString(s).replace(regexp, sub != _null ? sub : '');
    }
    function escapeRegExp(s) {
        return replace(s, /[\\\[\]\/{}()*+?.$|^-]/g, '\\$&');
    }
    function trim(s) {
        return replace(s, /^\s+|\s+$/g);
    }
    function eachObj(obj, cb, ctx) {
        for (var n in obj)
            if (obj.hasOwnProperty(n))
                cb.call(ctx || obj, n, obj[n]);
        return obj;
    }
    function each(list, cb, ctx) {
        if (list)
            for (var i = 0; i < list.length; i++)
                cb.call(ctx || list, list[i], i);
        return list;
    }
    function filter(list, filterFuncOrObject, ctx) {
        var r = [];
        var f = isFunction(filterFuncOrObject) ? filterFuncOrObject : function (value) {
            return filterFuncOrObject != value;
        };
        each(list, function (value, index) {
            if (f.call(ctx || list, value, index))
                r.push(value);
        });
        return r;
    }
    function collector(iterator, obj, collectFunc, ctx) {
        var result = [];
        iterator(obj, function (a, b) {
            if (isList(a = collectFunc.call(ctx || obj, a, b)))
                each(a, function (rr) {
                    result.push(rr);
                });
            else if (a != _null)
                result.push(a);
        });
        return result;
    }
    function collectObj(obj, collectFunc, ctx) {
        return collector(eachObj, obj, collectFunc, ctx);
    }
    function collect(list, collectFunc, ctx) {
        return collector(each, list, collectFunc, ctx);
    }
    function keyCount(obj) {
        var c = 0;
        eachObj(obj, function (key) {
            c++;
        });
        return c;
    }
    function keys(obj) {
        var list = [];
        eachObj(obj, function (key) {
            list.push(key);
        });
        return list;
    }
    function map(list, mapFunc, ctx) {
        var result = [];
        each(list, function (item, index) {
            result.push(mapFunc.call(ctx || list, item, index));
        });
        return result;
    }
    function startsWith(base, start) {
        if (isList(base)) {
            var s2 = _(start);
            return equals(sub(base, 0, s2.length), s2);
        } else
            return start != _null && base.substr(0, start.length) == start;
    }
    function endsWith(base, end) {
        if (isList(base)) {
            var e2 = _(end);
            return equals(sub(base, -e2.length), e2) || !e2.length;
        } else
            return end != _null && base.substr(base.length - end.length) == end;
    }
    function reverse(list) {
        var len = list.length;
        if (isList(list))
            return new M(map(list, function () {
                return list[--len];
            }));
        else
            return replace(list, /[\s\S]/g, function () {
                return list.charAt(--len);
            });
    }
    function toObject(list, value) {
        var obj = {};
        each(list, function (item, index) {
            obj[item] = value;
        });
        return obj;
    }
    function copyObj(from, to) {
        var dest = to || {};
        for (var name in from)
            dest[name] = from[name];
        return dest;
    }
    function merge(list, target) {
        var o = target;
        for (var i = 0; i < list.length; i++)
            o = copyObj(list[i], o);
        return o;
    }
    function getFindFunc(findFunc) {
        return isFunction(findFunc) ? findFunc : function (obj, index) {
            if (findFunc === obj)
                return index;
        };
    }
    function getFindIndex(list, index, defaultIndex) {
        return index == _null ? defaultIndex : index < 0 ? Math.max(list.length + index, 0) : Math.min(list.length, index);
    }
    function find(list, findFunc, startIndex, endIndex) {
        var f = getFindFunc(findFunc);
        var e = getFindIndex(list, endIndex, list.length);
        var r;
        for (var i = getFindIndex(list, startIndex, 0); i < e; i++)
            if ((r = f.call(list, list[i], i)) != _null)
                return r;
    }
    function findLast(list, findFunc, startIndex, endIndex) {
        var f = getFindFunc(findFunc);
        var e = getFindIndex(list, endIndex, -1);
        var r;
        for (var i = getFindIndex(list, startIndex, list.length - 1); i > e; i--)
            if ((r = f.call(list, list[i], i)) != _null)
                return r;
    }
    function sub(list, startIndex, endIndex) {
        var r = [];
        if (list) {
            var e = getFindIndex(list, endIndex, list.length);
            for (var i = getFindIndex(list, startIndex, 0); i < e; i++)
                r.push(list[i]);
        }
        return r;
    }
    function array(list) {
        return map(list, nonOp);
    }
    function unite(list) {
        return function () {
            return new M(callList(list, arguments));
        };
    }
    function uniq(list) {
        var found = {};
        return filter(list, function (item) {
            if (found[item])
                return false;
            else
                return found[item] = 1;
        });
    }
    function intersection(list, otherList) {
        var keys = toObject(otherList, 1);
        return filter(list, function (item) {
            var r = keys[item];
            keys[item] = 0;
            return r;
        });
    }
    function contains(list, value) {
        for (var i = 0; i < list.length; i++)
            if (list[i] == value)
                return true;
        return false;
    }
    function equals(x, y) {
        var a = isFunction(x) ? x() : x;
        var b = isFunction(y) ? y() : y;
        var aKeys;
        if (a == b)
            return true;
        else if (a == _null || b == _null)
            return false;
        else if (isValue(a) || isValue(b))
            return isDate(a) && isDate(b) && +a == +b;
        else if (isList(a)) {
            return a.length == b.length && !find(a, function (val, index) {
                if (!equals(val, b[index]))
                    return true;
            });
        } else {
            return !isList(b) && (aKeys = keys(a)).length == keyCount(b) && !find(aKeys, function (key) {
                if (!equals(a[key], b[key]))
                    return true;
            });
        }
    }
    function call(f, fThisOrArgs, args) {
        if (isFunction(f))
            return f.apply(args && fThisOrArgs, map(args || fThisOrArgs, nonOp));
    }
    function callList(list, fThisOrArgs, args) {
        return map(list, function (f) {
            return call(f, fThisOrArgs, args);
        });
    }
    function bind(f, fThis, beforeArgs, afterArgs) {
        return function () {
            return call(f, fThis, collect([
                beforeArgs,
                arguments,
                afterArgs
            ], nonOp));
        };
    }
    function partial(f, beforeArgs, afterArgs) {
        return bind(f, this, beforeArgs, afterArgs);
    }
    function pad(digits, number) {
        var signed = number < 0 ? '-' : '';
        var preDecimal = (signed ? -number : number).toFixed(0);
        while (preDecimal.length < digits)
            preDecimal = '0' + preDecimal;
        return signed + preDecimal;
    }
    function processNumCharTemplate(tpl, input, fwd) {
        var inHash;
        var inputPos = 0;
        var rInput = fwd ? input : reverse(input);
        var s = (fwd ? tpl : reverse(tpl)).replace(/./g, function (tplChar) {
            if (tplChar == '0') {
                inHash = false;
                return rInput.charAt(inputPos++) || '0';
            } else if (tplChar == '#') {
                inHash = true;
                return rInput.charAt(inputPos++) || '';
            } else
                return inHash && !rInput.charAt(inputPos) ? '' : tplChar;
        });
        return fwd ? s : input.substr(0, input.length - inputPos) + reverse(s);
    }
    function getTimezone(match, idx, refDate) {
        if (idx == _null || !match)
            return 0;
        return parseFloat(match[idx] + match[idx + 1]) * 60 + parseFloat(match[idx] + match[idx + 2]) + refDate.getTimezoneOffset();
    }
    function formatValue(fmt, value) {
        var format = replace(fmt, /^\?/);
        if (isDate(value)) {
            var timezone, match;
            if (match = /^\[(([+-])(\d\d)(\d\d))\]\s*(.*)/.exec(format)) {
                timezone = match[1];
                value = dateAdd(value, 'minutes', getTimezone(match, 2, value));
                format = match[5];
            }
            return replace(format, /(\w)(\1*)(?:\[([^\]]+)\])?/g, function (s, placeholderChar, placeholderDigits, params) {
                var val = FORMAT_DATE_MAP[placeholderChar];
                if (val) {
                    var d = value['get' + val[0]]();
                    var optionArray = params && params.split(',');
                    if (isList(val[1]))
                        d = (optionArray || val[1])[d];
                    else
                        d = val[1](d, optionArray, timezone);
                    if (d != _null && !isString(d))
                        d = pad(placeholderDigits.length + 1, d);
                    return d;
                } else
                    return s;
            });
        } else
            return find(format.split(/\s*\|\s*/), function (fmtPart) {
                var match, numFmtOrResult;
                if (match = /^([<>]?)(=?)([^:]*?)\s*:\s*(.*)$/.exec(fmtPart)) {
                    var cmpVal1 = value, cmpVal2 = +match[3];
                    if (isNaN(cmpVal2) || !isNumber(cmpVal1)) {
                        cmpVal1 = cmpVal1 == _null ? 'null' : toString(cmpVal1);
                        cmpVal2 = match[3];
                    }
                    if (match[1]) {
                        if (!match[2] && cmpVal1 == cmpVal2 || match[1] == '<' && cmpVal1 > cmpVal2 || match[1] == '>' && cmpVal1 < cmpVal2)
                            return _null;
                    } else if (cmpVal1 != cmpVal2)
                        return _null;
                    numFmtOrResult = match[4];
                } else
                    numFmtOrResult = fmtPart;
                if (isNumber(value))
                    return numFmtOrResult.replace(/[0#](.*[0#])?/, function (numFmt) {
                        var decimalFmt = /^([^.]+)(\.)([^.]+)$/.exec(numFmt) || /^([^,]+)(,)([^,]+)$/.exec(numFmt);
                        var signed = value < 0 ? '-' : '';
                        var numData = /(\d+)(\.(\d+))?/.exec((signed ? -value : value).toFixed(decimalFmt ? decimalFmt[3].length : 0));
                        var preDecimalFmt = decimalFmt ? decimalFmt[1] : numFmt;
                        var postDecimal = decimalFmt ? processNumCharTemplate(decimalFmt[3], replace(numData[3], /0+$/), true) : '';
                        return (signed ? '-' : '') + (preDecimalFmt == '#' ? numData[1] : processNumCharTemplate(preDecimalFmt, numData[1])) + (postDecimal.length ? decimalFmt[2] : '') + postDecimal;
                    });
                else
                    return numFmtOrResult;
            });
    }
    function parseDate(fmt, date) {
        var indexMap = {};
        var reIndex = 1;
        var timezoneOffsetMatch;
        var timezoneIndex;
        var match;
        var format = replace(fmt, /^\?/);
        if (format != fmt && !trim(date))
            return _null;
        if (match = /^\[([+-])(\d\d)(\d\d)\]\s*(.*)/.exec(format)) {
            timezoneOffsetMatch = match;
            format = match[4];
        }
        var parser = new RegExp(format.replace(/(.)(\1*)(?:\[([^\]]*)\])?/g, function (wholeMatch, placeholderChar, placeholderDigits, param) {
            if (/[dmhkyhs]/i.test(placeholderChar)) {
                indexMap[reIndex++] = placeholderChar;
                var plen = placeholderDigits.length + 1;
                return '(\\d' + (plen < 2 ? '+' : '{1,' + plen + '}') + ')';
            } else if (placeholderChar == 'z') {
                timezoneIndex = reIndex;
                reIndex += 3;
                return '([+-])(\\d\\d)(\\d\\d)';
            } else if (/[Nna]/.test(placeholderChar)) {
                indexMap[reIndex++] = [
                    placeholderChar,
                    param && param.split(',')
                ];
                return '([a-zA-Z\\u0080-\\u1fff]+)';
            } else if (/w/i.test(placeholderChar))
                return '[a-zA-Z\\u0080-\\u1fff]+';
            else if (/\s/.test(placeholderChar))
                return '\\s+';
            else
                return escapeRegExp(wholeMatch);
        }));
        if (!(match = parser.exec(date)))
            return undef;
        var ctorArgs = [
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ];
        for (var i = 1; i < reIndex; i++) {
            var matchVal = match[i];
            var indexEntry = indexMap[i];
            if (isList(indexEntry)) {
                var placeholderChar = indexEntry[0];
                var mapEntry = PARSE_DATE_MAP[placeholderChar];
                var ctorIndex = mapEntry[0];
                var valList = indexEntry[1] || mapEntry[1];
                var listValue = find(valList, function (v, index) {
                    if (startsWith(matchVal.toLowerCase(), v.toLowerCase()))
                        return index;
                });
                if (listValue == _null)
                    return undef;
                if (placeholderChar == 'a')
                    ctorArgs[ctorIndex] += listValue * 12;
                else
                    ctorArgs[ctorIndex] = listValue;
            } else if (indexEntry) {
                var value = parseFloat(matchVal);
                var mapEntry = PARSE_DATE_MAP[indexEntry];
                if (isList(mapEntry))
                    ctorArgs[mapEntry[0]] += value - mapEntry[1];
                else
                    ctorArgs[mapEntry] += value;
            }
        }
        var d = new Date(ctorArgs[0], ctorArgs[1], ctorArgs[2], ctorArgs[3], ctorArgs[4], ctorArgs[5], ctorArgs[6]);
        return dateAdd(d, 'minutes', -getTimezone(timezoneOffsetMatch, 1, d) - getTimezone(match, timezoneIndex, d));
    }
    function parseNumber(fmt, value) {
        var format = replace(fmt, /^\?/);
        if (format != fmt && !trim(value))
            return _null;
        var decSep = /(^|[^0#.,])(,|[0#.]*,[0#]+|[0#]+\.[0#]+\.[0#.,]*)($|[^0#.,])/.test(format) ? ',' : '.';
        var r = parseFloat(replace(replace(replace(value, decSep == ',' ? /\./g : /,/g), decSep, '.'), /^[^\d-]*(-?\d)/, '$1'));
        return isNaN(r) ? undef : r;
    }
    function now() {
        return new Date();
    }
    function dateClone(date) {
        return new Date(+date);
    }
    function capWord(w) {
        return w.charAt(0).toUpperCase() + w.substr(1);
    }
    function dateAddInline(d, cProp, value) {
        d['set' + cProp](d['get' + cProp]() + value);
        return d;
    }
    function dateAdd(date, property, value) {
        if (value == _null)
            return dateAdd(now(), date, property);
        return dateAddInline(dateClone(date), capWord(property), value);
    }
    function dateMidnight(date) {
        var od = date || now();
        return new Date(od.getFullYear(), od.getMonth(), od.getDate());
    }
    function dateDiff(property, date1, date2) {
        var d1t = +date1;
        var d2t = +date2;
        var dt = d2t - d1t;
        if (dt < 0)
            return -dateDiff(property, date2, date1);
        var propValues = {
            'milliseconds': 1,
            'seconds': 1000,
            'minutes': 60000,
            'hours': 3600000
        };
        var ft = propValues[property];
        if (ft)
            return dt / ft;
        var cProp = capWord(property);
        var calApproxValues = {
            'fullYear': 86400000 * 365,
            'month': 86400000 * 365 / 12,
            'date': 86400000
        };
        var minimumResult = Math.floor(dt / calApproxValues[property] - 2);
        var d = dateAddInline(new Date(d1t), cProp, minimumResult);
        for (var i = minimumResult; i < minimumResult * 1.2 + 4; i++) {
            if (+dateAddInline(d, cProp, 1) > d2t)
                return i;
        }
    }
    function ucode(a) {
        return '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
    }
    function escapeJavaScriptString(s) {
        return replace(s, /[\x00-\x1f'"\u2028\u2029]/g, ucode);
    }
    function split(str, regexp) {
        return str.split(regexp);
    }
    function template(template, escapeFunction) {
        if (templateCache[template])
            return templateCache[template];
        else {
            var funcBody = 'with(_.isObject(obj)?obj:{}){' + map(split(template, /{{|}}}?/g), function (chunk, index) {
                var match, c1 = trim(chunk), c2 = replace(c1, /^{/), escapeSnippet = c1 == c2 ? 'esc(' : '';
                if (index % 2) {
                    if (match = /^each\b(\s+([\w_]+(\s*,\s*[\w_]+)?)\s*:)?(.*)/.exec(c2))
                        return 'each(' + (trim(match[4]) ? match[4] : 'this') + ', function(' + match[2] + '){';
                    else if (match = /^if\b(.*)/.exec(c2))
                        return 'if(' + match[1] + '){';
                    else if (match = /^else\b\s*(if\b(.*))?/.exec(c2))
                        return '}else ' + (match[1] ? 'if(' + match[2] + ')' : '') + '{';
                    else if (match = /^\/(if)?/.exec(c2))
                        return match[1] ? '}\n' : '});\n';
                    else if (match = /^(var\s.*)/.exec(c2))
                        return match[1] + ';';
                    else if (match = /^#(.*)/.exec(c2))
                        return match[1];
                    else if (match = /(.*)::\s*(.*)/.exec(c2))
                        return 'print(' + escapeSnippet + '_.formatValue("' + escapeJavaScriptString(match[2]) + '",' + (trim(match[1]) ? match[1] : 'this') + (escapeSnippet && ')') + '));\n';
                    else
                        return 'print(' + escapeSnippet + (trim(c2) ? c2 : 'this') + (escapeSnippet && ')') + ');\n';
                } else if (chunk) {
                    return 'print("' + escapeJavaScriptString(chunk) + '");\n';
                }
            }).join('') + '}';
            var f = new Function('obj', 'each', 'esc', 'print', '_', funcBody);
            var t = function (obj, thisContext) {
                var result = [];
                f.call(thisContext || obj, obj, function (obj, func) {
                    if (isList(obj))
                        each(obj, function (value, index) {
                            func.call(value, value, index);
                        });
                    else
                        eachObj(obj, function (key, value) {
                            func.call(value, key, value);
                        });
                }, escapeFunction || nonOp, function () {
                    call(result['push'], result, arguments);
                }, _);
                return result.join('');
            };
            if (templates.push(t) > MAX_CACHED_TEMPLATES)
                delete templateCache[templates.shift()];
            return templateCache[template] = t;
        }
    }
    function escapeHtml(s) {
        return replace(s, /[<>'"&]/g, function (s) {
            return '&#' + s.charCodeAt(0) + ';';
        });
    }
    function formatHtml(tpl, obj) {
        return template(tpl, escapeHtml)(obj);
    }
    function listBindArray(func) {
        return function (arg1, arg2) {
            return new M(func(this, arg1, arg2));
        };
    }
    function listBind(func) {
        return function (arg1, arg2, arg3) {
            return func(this, arg1, arg2, arg3);
        };
    }
    function funcArrayBind(func) {
        return function (arg1, arg2, arg3) {
            return new M(func(arg1, arg2, arg3));
        };
    }
    function isFunction(f) {
        return typeof f == 'function' && !f['item'];
    }
    function isList(v) {
        return v && v.length != _null && !isString(v) && !isNode(v) && !isFunction(v) && v !== _window;
    }
    function push(obj, prop, value) {
        (obj[prop] = obj[prop] || []).push(value);
    }
    function removeFromArray(array, value) {
        for (var i = 0; array && i < array.length; i++)
            if (array[i] === value)
                array['splice'](i--, 1);
    }
    function extractNumber(v) {
        return parseFloat(replace(v, /^[^\d-]+/));
    }
    function getNodeId(el) {
        return el[MINIFIED_MAGIC_NODEID] = el[MINIFIED_MAGIC_NODEID] || ++idSequence;
    }
    function collectUniqNodes(list, func) {
        var result = [];
        var nodeIds = {};
        var currentNodeId;
        flexiEach(list, function (value) {
            flexiEach(func(value), function (node) {
                if (!nodeIds[currentNodeId = getNodeId(node)]) {
                    result.push(node);
                    nodeIds[currentNodeId] = true;
                }
            });
        });
        return result;
    }
    function getNaturalHeight(elementList, factor) {
        var q = {
            '$position': 'absolute',
            '$visibility': 'hidden',
            '$display': 'block',
            '$height': _null
        };
        var oldStyles = elementList['get'](q);
        var h = elementList['set'](q)['get']('clientHeight');
        elementList['set'](oldStyles);
        return h * factor + 'px';
    }
    function on(subSelector, eventSpec, handler, args, bubbleSelector) {
        if (isFunction(eventSpec))
            return this['on'](_null, subSelector, eventSpec, handler, args);
        else if (isString(args))
            return this['on'](subSelector, eventSpec, handler, _null, args);
        else
            return this['each'](function (baseElement, index) {
                flexiEach(subSelector ? dollarRaw(subSelector, baseElement) : baseElement, function (registeredOn) {
                    flexiEach(toString(eventSpec).split(/\s/), function (namePrefixed) {
                        var name = replace(namePrefixed, /[?|]/g);
                        var prefix = replace(namePrefixed, /[^?|]/g);
                        var capture = (name == 'blur' || name == 'focus') && !!bubbleSelector;
                        var triggerId = idSequence++;
                        function triggerHandler(eventName, event, target) {
                            var match = !bubbleSelector;
                            var el = bubbleSelector ? target : registeredOn;
                            if (bubbleSelector) {
                                var selectorFilter = getFilterFunc(bubbleSelector, registeredOn);
                                while (el && el != registeredOn && !(match = selectorFilter(el)))
                                    el = el['parentNode'];
                            }
                            return !match || name != eventName || (handler.apply($(el), args || [
                                event,
                                index
                            ]) && prefix == '?' || prefix == '|');
                        }
                        ;
                        function eventHandler(event) {
                            if (!triggerHandler(name, event, event['target'])) {
                                event['preventDefault']();
                                event['stopPropagation']();
                            }
                        }
                        ;
                        registeredOn.addEventListener(name, eventHandler, capture);
                        if (!registeredOn['M'])
                            registeredOn['M'] = {};
                        registeredOn['M'][triggerId] = triggerHandler;
                        handler['M'] = collector(flexiEach, [
                            handler['M'],
                            function () {
                                registeredOn.removeEventListener(name, eventHandler, capture);
                                delete registeredOn['M'][triggerId];
                            }
                        ], nonOp);
                    });
                });
            });
    }
    function off(handler) {
        callList(handler['M']);
        handler['M'] = _null;
    }
    function detachHandlerList(dummy, handlerList) {
        flexiEach(handlerList, function (h) {
            h.element.detachEvent('on' + h.eventType, h.handlerFunc);
        });
    }
    function ready(handler) {
        if (DOMREADY_HANDLER)
            DOMREADY_HANDLER.push(handler);
        else
            setTimeout(handler, 0);
    }
    function $$(selector, context, childrenOnly) {
        return dollarRaw(selector, context, childrenOnly)[0];
    }
    function EE(elementName, attributes, children) {
        var e = $(document.createElement(elementName));
        return isList(attributes) || attributes != _null && !isObject(attributes) ? e['add'](attributes) : e['set'](attributes)['add'](children);
    }
    function clone(listOrNode) {
        return collector(flexiEach, listOrNode, function (e) {
            var c;
            if (isList(e))
                return clone(e);
            else if (isNode(e)) {
                c = e['cloneNode'](true);
                c['removeAttribute'] && c['removeAttribute']('id');
                return c;
            } else
                return e;
        });
    }
    function $(selector, context, childOnly) {
        return isFunction(selector) ? ready(selector) : new M(dollarRaw(selector, context, childOnly));
    }
    function dollarRaw(selector, context, childOnly) {
        function flatten(a) {
            return isList(a) ? collector(flexiEach, a, flatten) : a;
        }
        function filterElements(list) {
            return filter(collector(flexiEach, list, flatten), function (node) {
                var a = node;
                while (a = a['parentNode'])
                    if (a == context[0] || childOnly)
                        return a == context[0];
            });
        }
        if (context) {
            if ((context = dollarRaw(context)).length != 1)
                return collectUniqNodes(context, function (ci) {
                    return dollarRaw(selector, ci, childOnly);
                });
            else if (isString(selector)) {
                if (isNode(context[0]) != 1)
                    return [];
                else
                    return childOnly ? filterElements(context[0].querySelectorAll(selector)) : context[0].querySelectorAll(selector);
            } else
                return filterElements(selector);
        } else if (isString(selector))
            return document.querySelectorAll(selector);
        else
            return collector(flexiEach, selector, flatten);
    }
    ;
    function getFilterFunc(selector, context) {
        function wordRegExpTester(name, prop) {
            var re = RegExp('(^|\\s+)' + name + '(?=$|\\s)', 'i');
            return function (obj) {
                return name ? re.test(obj[prop]) : true;
            };
        }
        var nodeSet = {};
        var dotPos = nodeSet;
        if (isFunction(selector))
            return selector;
        else if (isNumber(selector))
            return function (v, index) {
                return index == selector;
            };
        else if (!selector || selector == '*' || isString(selector) && (dotPos = /^([\w-]*)\.?([\w-]*)$/.exec(selector))) {
            var nodeNameFilter = wordRegExpTester(dotPos[1], 'tagName');
            var classNameFilter = wordRegExpTester(dotPos[2], 'className');
            return function (v) {
                return isNode(v) == 1 && nodeNameFilter(v) && classNameFilter(v);
            };
        } else if (context)
            return function (v) {
                return $(selector, context)['find'](v) != _null;
            };
        else {
            $(selector)['each'](function (node) {
                nodeSet[getNodeId(node)] = true;
            });
            return function (v) {
                return nodeSet[getNodeId(v)];
            };
        }
    }
    function getInverseFilterFunc(selector) {
        var f = getFilterFunc(selector);
        return function (v) {
            return f(v) ? _null : true;
        };
    }
    function flexiEach(list, cb) {
        if (isList(list))
            each(list, cb);
        else if (list != _null)
            cb(list, 0);
        return list;
    }
    function Promise() {
        this['state'] = null;
        this['values'] = [];
        this['parent'] = null;
    }
    function promise() {
        var deferred = [];
        var assimilatedPromises = arguments;
        var assimilatedNum = assimilatedPromises.length;
        var numCompleted = 0;
        var rejectionHandlerNum = 0;
        var obj = new Promise();
        obj['errHandled'] = function () {
            rejectionHandlerNum++;
            if (obj['parent'])
                obj['parent']['errHandled']();
        };
        var fire = obj['fire'] = function (newState, newValues) {
            if (obj['state'] == null && newState != null) {
                obj['state'] = !!newState;
                obj['values'] = isList(newValues) ? newValues : [newValues];
                setTimeout(function () {
                    each(deferred, function (f) {
                        f();
                    });
                }, 0);
            }
            return obj;
        };
        each(assimilatedPromises, function assimilate(promise, index) {
            try {
                if (promise['then'])
                    promise['then'](function (v) {
                        var then;
                        if ((isObject(v) || isFunction(v)) && isFunction(then = v['then']))
                            assimilate(v, index);
                        else {
                            obj['values'][index] = array(arguments);
                            if (++numCompleted == assimilatedNum)
                                fire(true, assimilatedNum < 2 ? obj['values'][index] : obj['values']);
                        }
                    }, function (e) {
                        obj['values'][index] = array(arguments);
                        fire(false, assimilatedNum < 2 ? obj['values'][index] : [
                            obj['values'][index][0],
                            obj['values'],
                            index
                        ]);
                    });
                else
                    promise(function () {
                        fire(true, array(arguments));
                    }, function () {
                        fire(false, array(arguments));
                    });
            } catch (e) {
                fire(false, [
                    e,
                    obj['values'],
                    index
                ]);
            }
        });
        obj['stop'] = function () {
            each(assimilatedPromises, function (promise) {
                if (promise['stop'])
                    promise['stop']();
            });
            return obj['stop0'] && call(obj['stop0']);
        };
        var then = obj['then'] = function (onFulfilled, onRejected) {
            var promise2 = promise();
            var callCallbacks = function () {
                try {
                    var f = obj['state'] ? onFulfilled : onRejected;
                    if (isFunction(f)) {
                        (function resolve(x) {
                            try {
                                var then, cbCalled = 0;
                                if ((isObject(x) || isFunction(x)) && isFunction(then = x['then'])) {
                                    if (x === promise2)
                                        throw new TypeError();
                                    then.call(x, function (x) {
                                        if (!cbCalled++)
                                            resolve(x);
                                    }, function (value) {
                                        if (!cbCalled++)
                                            promise2['fire'](false, [value]);
                                    });
                                    promise2['stop0'] = x['stop'];
                                } else
                                    promise2['fire'](true, [x]);
                            } catch (e) {
                                if (!cbCalled++) {
                                    promise2['fire'](false, [e]);
                                    if (!rejectionHandlerNum)
                                        throw e;
                                }
                            }
                        }(call(f, undef, obj['values'])));
                    } else
                        promise2['fire'](obj['state'], obj['values']);
                } catch (e) {
                    promise2['fire'](false, [e]);
                    if (!rejectionHandlerNum)
                        throw e;
                }
            };
            if (isFunction(onRejected))
                obj['errHandled']();
            promise2['stop0'] = obj['stop'];
            promise2['parent'] = obj;
            if (obj['state'] != null)
                setTimeout(callCallbacks, 0);
            else
                deferred.push(callCallbacks);
            return promise2;
        };
        obj['always'] = function (func) {
            return then(func, func);
        };
        obj['error'] = function (func) {
            return then(0, func);
        };
        return obj;
    }
    function M(list, assimilateSublists) {
        var self = this, idx = 0;
        if (list)
            for (var i = 0, len = list.length; i < len; i++) {
                var item = list[i];
                if (assimilateSublists && isList(item))
                    for (var j = 0, len2 = item.length; j < len2; j++)
                        self[idx++] = item[j];
                else
                    self[idx++] = item;
            }
        else
            self[idx++] = assimilateSublists;
        self['length'] = idx;
        self['_'] = true;
    }
    function _() {
        return new M(arguments, true);
    }
    copyObj({
        'each': listBind(each),
        'equals': listBind(equals),
        'find': listBind(find),
        dummySort: 0,
        'select': function (selector, childOnly) {
            return $(selector, this, childOnly);
        },
        'get': function (spec, toNumber) {
            var self = this;
            var element = self[0];
            if (element) {
                if (isString(spec)) {
                    var match = /^(\W*)(.*)/.exec(replace(spec, /^%/, '@data-'));
                    var prefix = match[1];
                    var s;
                    if (getter[prefix])
                        s = getter[prefix](this, match[2]);
                    else if (spec == '$')
                        s = self['get']('className');
                    else if (spec == '$$') {
                        s = self['get']('@style');
                    } else if (spec == '$$slide')
                        s = self['get']('$height');
                    else if (spec == '$$fade' || spec == '$$show') {
                        if (self['get']('$visibility') == 'hidden' || self['get']('$display') == 'none')
                            s = 0;
                        else if (spec == '$$fade') {
                            s = isNaN(self['get']('$opacity', true)) ? 1 : self['get']('$opacity', true);
                        } else
                            s = 1;
                    } else if (prefix == '$') {
                        s = _window['getComputedStyle'](element, _null)['getPropertyValue'](replace(match[2], /[A-Z]/g, function (match2) {
                            return '-' + match2.toLowerCase();
                        }));
                    } else if (prefix == '@')
                        s = element.getAttribute(match[2]);
                    else
                        s = element[match[2]];
                    return toNumber ? extractNumber(s) : s;
                } else {
                    var r = {};
                    (isList(spec) ? flexiEach : eachObj)(spec, function (name) {
                        r[name] = self['get'](name, toNumber);
                    });
                    return r;
                }
            }
        },
        'set': function (name, value) {
            var self = this;
            if (value !== undef) {
                var match = /^(\W*)(.*)/.exec(replace(replace(name, /^\$float$/, 'cssFloat'), /^%/, '@data-'));
                var prefix = match[1];
                if (setter[prefix])
                    setter[prefix](this, match[2], value);
                else if (name == '$$fade') {
                    this['set']({
                        '$visibility': value ? 'visible' : 'hidden',
                        '$opacity': value
                    });
                } else if (name == '$$slide') {
                    self['set']({
                        '$visibility': value ? 'visible' : 'hidden',
                        '$overflow': 'hidden',
                        '$height': /px/.test(value) ? value : function (oldValue, idx, element) {
                            return getNaturalHeight($(element), value);
                        }
                    });
                } else if (name == '$$show') {
                    if (value)
                        self['set']({
                            '$visibility': value ? 'visible' : 'hidden',
                            '$display': ''
                        })['set']({
                            '$display': function (oldVal) {
                                return oldVal == 'none' ? 'block' : oldVal;
                            }
                        });
                    else
                        self['set']({ '$display': 'none' });
                } else if (name == '$$') {
                    self['set']('@style', value);
                } else
                    flexiEach(this, function (obj, c) {
                        var newValue = isFunction(value) ? value($(obj)['get'](name), c, obj) : value;
                        if (prefix == '$') {
                            if (match[2])
                                obj['style'][match[2]] = newValue;
                            else {
                                flexiEach(newValue && newValue.split(/\s+/), function (clzz) {
                                    var cName = replace(clzz, /^[+-]/);
                                    if (/^\+/.test(clzz))
                                        obj['classList'].add(cName);
                                    else if (/^-/.test(clzz))
                                        obj['classList'].remove(cName);
                                    else
                                        obj['classList'].toggle(cName);
                                });
                            }
                        } else if (name == '$$scrollX')
                            obj['scroll'](newValue, $(obj)['get']('$$scrollY'));
                        else if (name == '$$scrollY')
                            obj['scroll']($(obj)['get']('$$scrollX'), newValue);
                        else if (prefix == '@') {
                            if (newValue == _null)
                                obj.removeAttribute(match[2]);
                            else
                                obj.setAttribute(match[2], newValue);
                        } else
                            obj[match[2]] = newValue;
                    });
            } else if (isString(name) || isFunction(name))
                self['set']('$', name);
            else
                eachObj(name, function (n, v) {
                    self['set'](n, v);
                });
            return self;
        },
        'add': function (children, addFunction) {
            return this['each'](function (e, index) {
                var lastAdded;
                function appendChildren(c) {
                    if (isList(c))
                        flexiEach(c, appendChildren);
                    else if (isFunction(c))
                        appendChildren(c(e, index));
                    else if (c != _null) {
                        var n = isNode(c) ? c : document.createTextNode(c);
                        if (lastAdded)
                            lastAdded['parentNode']['insertBefore'](n, lastAdded['nextSibling']);
                        else if (addFunction)
                            addFunction(n, e, e['parentNode']);
                        else
                            e.appendChild(n);
                        lastAdded = n;
                    }
                }
                appendChildren(index && !isFunction(children) ? clone(children) : children);
            });
        },
        'on': on,
        'trigger': function (eventName, eventObj) {
            return this['each'](function (element, index) {
                var bubbleOn = true, el = element;
                while (el && bubbleOn) {
                    eachObj(el['M'], function (id, f) {
                        bubbleOn = bubbleOn && f(eventName, eventObj, element);
                    });
                    el = el['parentNode'];
                }
            });
        },
        'ht': function (htmlTemplate, object) {
            var o = arguments.length > 2 ? merge(sub(arguments, 1)) : object;
            return this['set']('innerHTML', isFunction(htmlTemplate) ? htmlTemplate(o) : /{{/.test(htmlTemplate) ? formatHtml(htmlTemplate, o) : /^#\S+$/.test(htmlTemplate) ? formatHtml($$(htmlTemplate)['text'], o) : htmlTemplate);
        }
    }, M.prototype);
    copyObj({
        'request': function (method, url, data, settings0) {
            var settings = settings0 || {};
            var xhr, callbackCalled = 0, prom = promise(), dataIsMap = data && data['constructor'] == settings['constructor'];
            try {
                prom['xhr'] = xhr = new XMLHttpRequest();
                prom['stop0'] = function () {
                    xhr['abort']();
                };
                if (dataIsMap) {
                    data = collector(eachObj, data, function processParam(paramName, paramValue) {
                        return collector(flexiEach, paramValue, function (v) {
                            return encodeURIComponent(paramName) + (v != _null ? '=' + encodeURIComponent(v) : '');
                        });
                    }).join('&');
                }
                if (data != _null && !/post/i.test(method)) {
                    url += '?' + data;
                    data = _null;
                }
                xhr['open'](method, url, true, settings['user'], settings['pass']);
                if (dataIsMap && /post/i.test(method))
                    xhr['setRequestHeader']('Content-Type', 'application/x-www-form-urlencoded');
                eachObj(settings['headers'], function (hdrName, hdrValue) {
                    xhr['setRequestHeader'](hdrName, hdrValue);
                });
                eachObj(settings['xhr'], function (name, value) {
                    xhr[name] = value;
                });
                xhr['onreadystatechange'] = function () {
                    if (xhr['readyState'] == 4 && !callbackCalled++) {
                        if (xhr['status'] >= 200 && xhr['status'] < 300)
                            prom['fire'](true, [
                                xhr['responseText'],
                                xhr
                            ]);
                        else
                            prom['fire'](false, [
                                xhr['status'],
                                xhr['responseText'],
                                xhr
                            ]);
                    }
                };
                xhr['send'](data);
            } catch (e) {
                if (!callbackCalled)
                    prom['fire'](false, [
                        0,
                        _null,
                        toString(e)
                    ]);
            }
            return prom;
        },
        'ready': ready,
        'off': off,
        'wait': function (durationMs, args) {
            var p = promise();
            var id = setTimeout(function () {
                p['fire'](true, args);
            }, durationMs);
            p['stop0'] = function () {
                p['fire'](false);
                clearTimeout(id);
            };
            return p;
        }
    }, $);
    copyObj({
        'each': each,
        'toObject': toObject,
        'find': find,
        'equals': equals,
        'copyObj': copyObj,
        'extend': function (target) {
            return merge(sub(arguments, 1), target);
        },
        'eachObj': eachObj,
        'isObject': isObject,
        'format': function (tpl, object, escapeFunction) {
            return template(tpl, escapeFunction)(object);
        },
        'template': template,
        'formatHtml': formatHtml,
        'promise': promise
    }, _);
    document.addEventListener('DOMContentLoaded', function () {
        callList(DOMREADY_HANDLER);
        DOMREADY_HANDLER = _null;
    }, false);
    return {
        'HTML': function () {
            var div = EE('div');
            return _(call(div['ht'], div, arguments)[0].childNodes);
        },
        '_': _,
        '$': $,
        '$$': $$,
        'M': M,
        'getter': getter,
        'setter': setter
    };
}();
},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvc2NyaXB0cy9jb25maWctcGFnZS5qcyIsInNyYy9zY3JpcHRzL2xpYi9jbGF5LWNvbmZpZy5qcyIsInNyYy9zY3JpcHRzL2xpYi9jbGF5LWV2ZW50cy5qcyIsInNyYy9zY3JpcHRzL2xpYi9jbGF5LWl0ZW0uanMiLCJzcmMvc2NyaXB0cy9saWIvY29tcG9uZW50LXJlZ2lzdHJ5LmpzIiwic3JjL3NjcmlwdHMvbGliL21hbmlwdWxhdG9ycy5qcyIsInNyYy9zY3JpcHRzL2xpYi91dGlscy5qcyIsInNyYy9zY3JpcHRzL3ZlbmRvci9taW5pZmllZC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIid1c2Ugc3RyaWN0JztcblxudmFyIG1pbmlmaWVkID0gcmVxdWlyZSgnLi92ZW5kb3IvbWluaWZpZWQnKTtcbnZhciBDbGF5Q29uZmlnID0gcmVxdWlyZSgnLi9saWIvY2xheS1jb25maWcnKTtcblxudmFyICQgPSBtaW5pZmllZC4kO1xudmFyIF8gPSBtaW5pZmllZC5fO1xuXG52YXIgY29uZmlnID0gXy5leHRlbmQoW10sIHdpbmRvdy5jbGF5Q29uZmlnIHx8IFtdKTtcbnZhciBzZXR0aW5ncyA9IF8uZXh0ZW5kKHt9LCB3aW5kb3cuY2xheVNldHRpbmdzIHx8IHt9KTtcbnZhciByZXR1cm5UbyA9IHdpbmRvdy5yZXR1cm5UbyB8fCAncGViYmxlanM6Ly9jbG9zZSMnO1xudmFyIGN1c3RvbUZuID0gd2luZG93LmN1c3RvbUZuIHx8IGZ1bmN0aW9uKCkge307XG52YXIgY2xheUNvbXBvbmVudHMgPSB3aW5kb3cuY2xheUNvbXBvbmVudHMgfHwge307XG52YXIgY2xheU1ldGEgPSB3aW5kb3cuY2xheU1ldGEgfHwge307XG5cbnZhciBwbGF0Zm9ybSA9IHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50Lm1hdGNoKC9hbmRyb2lkL2kpID8gJ2FuZHJvaWQnIDogJ2lvcyc7XG5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xhc3NMaXN0LmFkZCgncGxhdGZvcm0tJyArIHBsYXRmb3JtKTtcblxuLy8gUmVnaXN0ZXIgdGhlIHBhc3NlZCBjb21wb25lbnRzXG5fLmVhY2hPYmooY2xheUNvbXBvbmVudHMsIGZ1bmN0aW9uKGtleSwgY29tcG9uZW50KSB7XG4gIENsYXlDb25maWcucmVnaXN0ZXJDb21wb25lbnQoY29tcG9uZW50KTtcbn0pO1xuXG52YXIgJG1haW5Gb3JtID0gJCgnI21haW4tZm9ybScpO1xudmFyIGNsYXlDb25maWcgPSBuZXcgQ2xheUNvbmZpZyhzZXR0aW5ncywgY29uZmlnLCAkbWFpbkZvcm0sIGNsYXlNZXRhKTtcblxuLy8gYWRkIGxpc3RlbmVycyBoZXJlXG4kbWFpbkZvcm0ub24oJ3N1Ym1pdCcsIGZ1bmN0aW9uKCkge1xuICAvLyBTZXQgdGhlIHJldHVybiBVUkwgZGVwZW5kaW5nIG9uIHRoZSBydW50aW1lIGVudmlyb25tZW50XG4gIGxvY2F0aW9uLmhyZWYgPSByZXR1cm5UbyArXG4gICAgICAgICAgICAgICAgICBlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkoY2xheUNvbmZpZy5zZXJpYWxpemUoKSkpO1xufSk7XG5cbi8vIFJ1biB0aGUgY3VzdG9tIGZ1bmN0aW9uIGluIHRoZSBjb250ZXh0IG9mIHRoZSBDbGF5Q29uZmlnXG5jdXN0b21Gbi5jYWxsKGNsYXlDb25maWcsIG1pbmlmaWVkKTtcblxuLy8gTm93IHRoYXQgd2UgaGF2ZSBnaXZlbiB0aGUgZGV2J3MgY3VzdG9tIGNvZGUgdG8gcnVuIGFuZCBhdHRhY2ggbGlzdGVuZXJzLFxuLy8gd2UgYnVpbGQgdGhlIGNvbmZpZ1xuY2xheUNvbmZpZy5idWlsZCgpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEEgQ2xheSBjb25maWcgSXRlbVxuICogQHR5cGVkZWYge09iamVjdH0gQ2xheX5Db25maWdJdGVtXG4gKiBAcHJvcGVydHkge3N0cmluZ30gdHlwZVxuICogQHByb3BlcnR5IHtzdHJpbmd8Ym9vbGVhbnxudW1iZXJ9IGRlZmF1bHRWYWx1ZVxuICogQHByb3BlcnR5IHtzdHJpbmd9IFttZXNzYWdlS2V5XVxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtpZF1cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbbGFiZWxdXG4gKiBAcHJvcGVydHkge09iamVjdH0gW2F0dHJpYnV0ZXNdXG4gKiBAcHJvcGVydHkge0FycmF5fSBbb3B0aW9uc11cbiAqIEBwcm9wZXJ0eSB7QXJyYXl9IFtpdGVtc11cbiAqIEBwcm9wZXJ0eSB7QXJyYXl9IFtjYXBhYmlsaXRpZXNdXG4gKi9cblxudmFyIEhUTUwgPSByZXF1aXJlKCcuLi92ZW5kb3IvbWluaWZpZWQnKS5IVE1MO1xudmFyIF8gPSByZXF1aXJlKCcuLi92ZW5kb3IvbWluaWZpZWQnKS5fO1xudmFyIENsYXlJdGVtID0gcmVxdWlyZSgnLi9jbGF5LWl0ZW0nKTtcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4uL2xpYi91dGlscycpO1xudmFyIENsYXlFdmVudHMgPSByZXF1aXJlKCcuL2NsYXktZXZlbnRzJyk7XG52YXIgY29tcG9uZW50U3RvcmUgPSByZXF1aXJlKCcuL2NvbXBvbmVudC1yZWdpc3RyeScpO1xudmFyIG1hbmlwdWxhdG9ycyA9IHJlcXVpcmUoJy4vbWFuaXB1bGF0b3JzJyk7XG5cbi8qKlxuICogQGV4dGVuZHMgQ2xheUV2ZW50c1xuICogQHBhcmFtIHtPYmplY3R9IHNldHRpbmdzIC0gc2V0dGluZyB0aGF0IHdlcmUgc2V0IGZyb20gYSBwcmV2aW91cyBzZXNzaW9uXG4gKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gY29uZmlnXG4gKiBAcGFyYW0ge019ICRyb290Q29udGFpbmVyXG4gKiBAcGFyYW0ge09iamVjdH0gbWV0YVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIENsYXlDb25maWcoc2V0dGluZ3MsIGNvbmZpZywgJHJvb3RDb250YWluZXIsIG1ldGEpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHZhciBfc2V0dGluZ3MgPSBfLmNvcHlPYmooc2V0dGluZ3MpO1xuICB2YXIgX2l0ZW1zO1xuICB2YXIgX2l0ZW1zQnlJZDtcbiAgdmFyIF9pdGVtc0J5TWVzc2FnZUtleTtcbiAgdmFyIF9pc0J1aWx0O1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIHRoZSBpdGVtIGFycmF5cyBhbmQgb2JqZWN0c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgKi9cbiAgZnVuY3Rpb24gX2luaXRpYWxpemVJdGVtcygpIHtcbiAgICBfaXRlbXMgPSBbXTtcbiAgICBfaXRlbXNCeUlkID0ge307XG4gICAgX2l0ZW1zQnlNZXNzYWdlS2V5ID0ge307XG4gICAgX2lzQnVpbHQgPSBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgaXRlbShzKSB0byB0aGUgY29uZmlnXG4gICAqIEBwYXJhbSB7Q2xheX5Db25maWdJdGVtfEFycmF5fSBpdGVtXG4gICAqIEBwYXJhbSB7TX0gJGNvbnRhaW5lclxuICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgKi9cbiAgZnVuY3Rpb24gX2FkZEl0ZW1zKGl0ZW0sICRjb250YWluZXIpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShpdGVtKSkge1xuICAgICAgaXRlbS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgX2FkZEl0ZW1zKGl0ZW0sICRjb250YWluZXIpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh1dGlscy5pbmNsdWRlc0NhcGFiaWxpdHkobWV0YS5hY3RpdmVXYXRjaEluZm8sIGl0ZW0uY2FwYWJpbGl0aWVzKSkge1xuICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gJ3NlY3Rpb24nKSB7XG4gICAgICAgIHZhciAkd3JhcHBlciA9IEhUTUwoJzxkaXYgY2xhc3M9XCJzZWN0aW9uXCI+Jyk7XG4gICAgICAgICRjb250YWluZXIuYWRkKCR3cmFwcGVyKTtcbiAgICAgICAgX2FkZEl0ZW1zKGl0ZW0uaXRlbXMsICR3cmFwcGVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBfaXRlbSA9IF8uY29weU9iaihpdGVtKTtcbiAgICAgICAgX2l0ZW0uY2xheUlkID0gX2l0ZW1zLmxlbmd0aDtcblxuICAgICAgICB2YXIgY2xheUl0ZW0gPSBuZXcgQ2xheUl0ZW0oX2l0ZW0pLmluaXRpYWxpemUoc2VsZik7XG5cbiAgICAgICAgaWYgKF9pdGVtLmlkKSB7XG4gICAgICAgICAgX2l0ZW1zQnlJZFtfaXRlbS5pZF0gPSBjbGF5SXRlbTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfaXRlbS5tZXNzYWdlS2V5KSB7XG4gICAgICAgICAgX2l0ZW1zQnlNZXNzYWdlS2V5W19pdGVtLm1lc3NhZ2VLZXldID0gY2xheUl0ZW07XG4gICAgICAgIH1cblxuICAgICAgICBfaXRlbXMucHVzaChjbGF5SXRlbSk7XG5cbiAgICAgICAgLy8gc2V0IHRoZSB2YWx1ZSBvZiB0aGUgaXRlbSB2aWEgdGhlIG1hbmlwdWxhdG9yIHRvIGVuc3VyZSBjb25zaXN0ZW5jeVxuICAgICAgICB2YXIgdmFsdWU7XG4gICAgICAgIC8vSWYgbG9jYWxTdG9yYWdlIGNvbnRhaW5zIGFuIGVudHJ5IGZvciB0aGUgaXRlbXMgbWVzc2FnZUtleVxuICAgICAgICBpZiAodHlwZW9mIF9zZXR0aW5nc1tfaXRlbS5tZXNzYWdlS2V5XSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICB2YWx1ZSA9IF9zZXR0aW5nc1tfaXRlbS5tZXNzYWdlS2V5XTtcbiAgICAgICAgfSBcbiAgICAgICAgLy9JZiBsb2NhbFN0b3JhZ2UgY29udGFpbnMgYW4gZW50cnkgZm9yIHRoZSBpdGVtcyBpZFxuICAgICAgICBlbHNlIGlmICh0eXBlb2YgX3NldHRpbmdzW19pdGVtLmlkXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICB2YWx1ZSA9IF9zZXR0aW5nc1tfaXRlbS5pZF07XG4gICAgICAgIH0gXG4gICAgICAgIC8vanVzdCBzZXQgdGhlIGRlZmF1bHRWYWx1ZSBmcm9tIHRoZSBjb25maWcgZmlsZVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IF9pdGVtLmRlZmF1bHRWYWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vU2V0IHZhbHVlIG9mIGl0ZW1cbiAgICAgICAgY2xheUl0ZW0uc2V0KHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgPyB2YWx1ZSA6ICcnKTtcblxuICAgICAgICAkY29udGFpbmVyLmFkZChjbGF5SXRlbS4kZWxlbWVudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRocm93cyBpZiB0aGUgY29uZmlnIGhhcyBub3QgYmVlbiBidWlsdCB5ZXQuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmbk5hbWVcbiAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBmdW5jdGlvbiBfY2hlY2tCdWlsdChmbk5hbWUpIHtcbiAgICBpZiAoIV9pc0J1aWx0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdDbGF5Q29uZmlnIG5vdCBidWlsdC4gYnVpbGQoKSBtdXN0IGJlIHJ1biBiZWZvcmUgJyArXG4gICAgICAgICd5b3UgY2FuIHJ1biAnICsgZm5OYW1lICsgJygpJ1xuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBzZWxmLm1ldGEgPSBtZXRhO1xuICBzZWxmLiRyb290Q29udGFpbmVyID0gJHJvb3RDb250YWluZXI7XG5cbiAgc2VsZi5FVkVOVFMgPSB7XG4gICAgLyoqXG4gICAgICogQ2FsbGVkIGJlZm9yZSBmcmFtZXdvcmsgaGFzIGluaXRpYWxpemVkLiBUaGlzIGlzIHdoZW4geW91IHdvdWxkIGF0dGFjaCB5b3VyXG4gICAgICogY3VzdG9tIGNvbXBvbmVudHMuXG4gICAgICogQGNvbnN0XG4gICAgICovXG4gICAgQkVGT1JFX0JVSUxEOiAnQkVGT1JFX0JVSUxEJyxcblxuICAgIC8qKlxuICAgICAqIENhbGxlZCBhZnRlciB0aGUgY29uZmlnIGhhcyBiZWVuIHBhcnNlZCBhbmQgYWxsIGNvbXBvbmVudHMgaGF2ZSB0aGVpciBpbml0aWFsXG4gICAgICogdmFsdWUgc2V0XG4gICAgICogQGNvbnN0XG4gICAgICovXG4gICAgQUZURVJfQlVJTEQ6ICdBRlRFUl9CVUlMRCcsXG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgaWYgLmJ1aWxkKCkgaXMgZXhlY3V0ZWQgYWZ0ZXIgdGhlIHBhZ2UgaGFzIGFscmVhZHkgYmVlbiBidWlsdCBhbmRcbiAgICAgKiBiZWZvcmUgdGhlIGV4aXN0aW5nIGNvbnRlbnQgaXMgZGVzdHJveWVkXG4gICAgICogQGNvbnN0XG4gICAgICovXG4gICAgQkVGT1JFX0RFU1RST1k6ICdCRUZPUkVfREVTVFJPWScsXG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgaWYgLmJ1aWxkKCkgaXMgZXhlY3V0ZWQgYWZ0ZXIgdGhlIHBhZ2UgaGFzIGFscmVhZHkgYmVlbiBidWlsdCBhbmQgYWZ0ZXJcbiAgICAgKiB0aGUgZXhpc3RpbmcgY29udGVudCBpcyBkZXN0cm95ZWRcbiAgICAgKiBAY29uc3RcbiAgICAgKi9cbiAgICBBRlRFUl9ERVNUUk9ZOiAnQUZURVJfREVTVFJPWSdcbiAgfTtcbiAgdXRpbHMudXBkYXRlUHJvcGVydGllcyhzZWxmLkVWRU5UUywge3dyaXRhYmxlOiBmYWxzZX0pO1xuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7QXJyYXkuPENsYXlJdGVtPn1cbiAgICovXG4gIHNlbGYuZ2V0QWxsSXRlbXMgPSBmdW5jdGlvbigpIHtcbiAgICBfY2hlY2tCdWlsdCgnZ2V0QWxsSXRlbXMnKTtcbiAgICByZXR1cm4gX2l0ZW1zO1xuICB9O1xuXG4gIC8qKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZUtleVxuICAgKiBAcmV0dXJucyB7Q2xheUl0ZW19XG4gICAqL1xuICBzZWxmLmdldEl0ZW1CeU1lc3NhZ2VLZXkgPSBmdW5jdGlvbihtZXNzYWdlS2V5KSB7XG4gICAgX2NoZWNrQnVpbHQoJ2dldEl0ZW1CeU1lc3NhZ2VLZXknKTtcbiAgICByZXR1cm4gX2l0ZW1zQnlNZXNzYWdlS2V5W21lc3NhZ2VLZXldO1xuICB9O1xuXG4gIC8qKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gaWRcbiAgICogQHJldHVybnMge0NsYXlJdGVtfVxuICAgKi9cbiAgc2VsZi5nZXRJdGVtQnlJZCA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgX2NoZWNrQnVpbHQoJ2dldEl0ZW1CeUlkJyk7XG4gICAgcmV0dXJuIF9pdGVtc0J5SWRbaWRdO1xuICB9O1xuXG4gIC8qKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZVxuICAgKiBAcmV0dXJucyB7QXJyYXkuPENsYXlJdGVtPn1cbiAgICovXG4gIHNlbGYuZ2V0SXRlbXNCeVR5cGUgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgX2NoZWNrQnVpbHQoJ2dldEl0ZW1zQnlUeXBlJyk7XG4gICAgcmV0dXJuIF9pdGVtcy5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgcmV0dXJuIGl0ZW0uY29uZmlnLnR5cGUgPT09IHR5cGU7XG4gICAgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBncm91cFxuICAgKiBAcmV0dXJucyB7QXJyYXkuPENsYXlJdGVtPn1cbiAgICovXG4gIHNlbGYuZ2V0SXRlbXNCeUdyb3VwID0gZnVuY3Rpb24oZ3JvdXApIHtcbiAgICBfY2hlY2tCdWlsdCgnZ2V0SXRlbXNCeUdyb3VwJyk7XG4gICAgcmV0dXJuIF9pdGVtcy5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgcmV0dXJuIGl0ZW0uY29uZmlnLmdyb3VwID09PSBncm91cDtcbiAgICB9KTtcbiAgfTtcblxuICAvKipcbiAgICogQHJldHVybnMge09iamVjdH1cbiAgICovXG4gIHNlbGYuc2VyaWFsaXplID0gZnVuY3Rpb24oKSB7XG4gICAgX2NoZWNrQnVpbHQoJ3NlcmlhbGl6ZScpO1xuXG4gICAgX3NldHRpbmdzID0ge307XG5cbiAgICBfLmVhY2hPYmooX2l0ZW1zQnlNZXNzYWdlS2V5LCBmdW5jdGlvbihtZXNzYWdlS2V5LCBpdGVtKSB7XG4gICAgICBfc2V0dGluZ3NbbWVzc2FnZUtleV0gPSB7XG4gICAgICAgIHZhbHVlOiBpdGVtLmdldCgpXG4gICAgICB9O1xuXG4gICAgICBpZiAoaXRlbS5wcmVjaXNpb24pIHtcbiAgICAgICAgX3NldHRpbmdzW21lc3NhZ2VLZXldLnByZWNpc2lvbiA9IGl0ZW0ucHJlY2lzaW9uO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBfc2V0dGluZ3M7XG4gIH07XG5cbiAgLy8gQHRvZG8gbWF5YmUgZG9uJ3QgZG8gdGhpcyBhbmQgZm9yY2UgdGhlIHN0YXRpYyBtZXRob2RcbiAgc2VsZi5yZWdpc3RlckNvbXBvbmVudCA9IENsYXlDb25maWcucmVnaXN0ZXJDb21wb25lbnQ7XG5cbiAgLyoqXG4gICAqIEVtcHRpZXMgdGhlIHJvb3QgY29udGFpbmVyXG4gICAqIEByZXR1cm5zIHtDbGF5Q29uZmlnfVxuICAgKi9cbiAgc2VsZi5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGVsID0gJHJvb3RDb250YWluZXJbMF07XG4gICAgc2VsZi50cmlnZ2VyKHNlbGYuRVZFTlRTLkJFRk9SRV9ERVNUUk9ZKTtcbiAgICB3aGlsZSAoZWwuZmlyc3RDaGlsZCkge1xuICAgICAgZWwucmVtb3ZlQ2hpbGQoZWwuZmlyc3RDaGlsZCk7XG4gICAgfVxuICAgIF9pbml0aWFsaXplSXRlbXMoKTtcbiAgICBzZWxmLnRyaWdnZXIoc2VsZi5FVkVOVFMuQUZURVJfREVTVFJPWSk7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIEJ1aWxkIHRoZSBjb25maWcgcGFnZS4gVGhpcyBtdXN0IGJlIHJ1biBiZWZvcmUgYW55IG9mIHRoZSBnZXQgbWV0aG9kcyBjYW4gYmUgcnVuXG4gICAqIElmIHlvdSBjYWxsIHRoaXMgbWV0aG9kIGFmdGVyIHRoZSBwYWdlIGhhcyBhbHJlYWR5IGJlZW4gYnVpbHQsIHRlaCBwYWdlIHdpbGwgYmVcbiAgICogZGVzdHJveWVkIGFuZCBidWlsdCBhZ2Fpbi5cbiAgICogQHJldHVybnMge0NsYXlDb25maWd9XG4gICAqL1xuICBzZWxmLmJ1aWxkID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKF9pc0J1aWx0KSB7XG4gICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICB9XG4gICAgc2VsZi50cmlnZ2VyKHNlbGYuRVZFTlRTLkJFRk9SRV9CVUlMRCk7XG4gICAgX2FkZEl0ZW1zKHNlbGYuY29uZmlnLCAkcm9vdENvbnRhaW5lcik7XG4gICAgX2lzQnVpbHQgPSB0cnVlO1xuICAgIHNlbGYudHJpZ2dlcihzZWxmLkVWRU5UUy5BRlRFUl9CVUlMRCk7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH07XG5cbiAgX2luaXRpYWxpemVJdGVtcygpO1xuXG4gIC8vIGF0dGFjaCBldmVudCBtZXRob2RzXG4gIENsYXlFdmVudHMuY2FsbChzZWxmLCAkcm9vdENvbnRhaW5lcik7XG5cbiAgLy8gcHJldmVudCBleHRlcm5hbCBtb2RpZmljYXRpb25zIG9mIHByb3BlcnRpZXNcbiAgdXRpbHMudXBkYXRlUHJvcGVydGllcyhzZWxmLCB7IHdyaXRhYmxlOiBmYWxzZSwgY29uZmlndXJhYmxlOiBmYWxzZSB9KTtcblxuICAvLyBleHBvc2UgdGhlIGNvbmZpZyB0byBhbGxvdyBkZXZlbG9wZXJzIHRvIHVwZGF0ZSBpdCBiZWZvcmUgdGhlIGJ1aWxkIGlzIHJ1blxuICBzZWxmLmNvbmZpZyA9IGNvbmZpZztcbn1cblxuLyoqXG4gKiBSZWdpc3RlciBhIGNvbXBvbmVudCB0byBDbGF5LiBUaGlzIG11c3QgYmUgY2FsbGVkIHByaW9yIHRvIC5idWlsZCgpO1xuICogQHBhcmFtIHtPYmplY3R9IGNvbXBvbmVudCAtIHRoZSBjbGF5IGNvbXBvbmVudCB0byByZWdpc3RlclxuICogQHBhcmFtIHtzdHJpbmd9IGNvbXBvbmVudC5uYW1lIC0gdGhlIG5hbWUgb2YgdGhlIGNvbXBvbmVudFxuICogQHBhcmFtIHtzdHJpbmd9IGNvbXBvbmVudC50ZW1wbGF0ZSAtIEhUTUwgdGVtcGxhdGUgdG8gdXNlIGZvciB0aGUgY29tcG9uZW50XG4gKiBAcGFyYW0ge3N0cmluZ3xPYmplY3R9IGNvbXBvbmVudC5tYW5pcHVsYXRvciAtIG1ldGhvZHMgdG8gYXR0YWNoIHRvIHRoZSBjb21wb25lbnRcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNvbXBvbmVudC5tYW5pcHVsYXRvci5zZXQgLSBzZXQgbWFuaXB1bGF0b3IgbWV0aG9kXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjb21wb25lbnQubWFuaXB1bGF0b3IuZ2V0IC0gZ2V0IG1hbmlwdWxhdG9yIG1ldGhvZFxuICogQHBhcmFtIHtPYmplY3R9IFtjb21wb25lbnQuZGVmYXVsdHNdIC0gdGVtcGxhdGUgZGVmYXVsdHNcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IFtjb21wb25lbnQuaW5pdGlhbGl6ZV0gLSBtZXRob2QgdG8gc2NhZmZvbGQgdGhlIGNvbXBvbmVudFxuICogQHJldHVybiB7Ym9vbGVhbn0gLSBSZXR1cm5zIHRydWUgaWYgY29tcG9uZW50IHdhcyByZWdpc3RlcmVkIGNvcnJlY3RseVxuICovXG5DbGF5Q29uZmlnLnJlZ2lzdGVyQ29tcG9uZW50ID0gZnVuY3Rpb24oY29tcG9uZW50KSB7XG4gIHZhciBfY29tcG9uZW50ID0gXy5jb3B5T2JqKGNvbXBvbmVudCk7XG5cbiAgaWYgKGNvbXBvbmVudFN0b3JlW19jb21wb25lbnQubmFtZV0pIHtcbiAgICBjb25zb2xlLndhcm4oJ0NvbXBvbmVudDogJyArIF9jb21wb25lbnQubmFtZSArXG4gICAgICAgICAgICAgICAgICcgaXMgYWxyZWFkeSByZWdpc3RlcmVkLiBJZiB5b3Ugd2lzaCB0byBvdmVycmlkZSB0aGUgZXhpc3RpbmcnICtcbiAgICAgICAgICAgICAgICAgJyBmdW5jdGlvbmFsaXR5LCB5b3UgbXVzdCBwcm92aWRlIGEgbmV3IG5hbWUnKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAodHlwZW9mIF9jb21wb25lbnQubWFuaXB1bGF0b3IgPT09ICdzdHJpbmcnKSB7XG4gICAgX2NvbXBvbmVudC5tYW5pcHVsYXRvciA9IG1hbmlwdWxhdG9yc1tjb21wb25lbnQubWFuaXB1bGF0b3JdO1xuXG4gICAgaWYgKCFfY29tcG9uZW50Lm1hbmlwdWxhdG9yKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBtYW5pcHVsYXRvcjogJyArIGNvbXBvbmVudC5tYW5pcHVsYXRvciArXG4gICAgICAgICAgICAgICAgICAgICAgJyBkb2VzIG5vdCBleGlzdCBpbiB0aGUgYnVpbHQtaW4gbWFuaXB1bGF0b3JzLicpO1xuICAgIH1cbiAgfVxuXG4gIGlmICghX2NvbXBvbmVudC5tYW5pcHVsYXRvcikge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhlIG1hbmlwdWxhdG9yIG11c3QgYmUgZGVmaW5lZCcpO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBfY29tcG9uZW50Lm1hbmlwdWxhdG9yLnNldCAhPT0gJ2Z1bmN0aW9uJyB8fFxuICAgICAgdHlwZW9mIF9jb21wb25lbnQubWFuaXB1bGF0b3IuZ2V0ICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgbWFuaXB1bGF0b3IgbXVzdCBoYXZlIGJvdGggYSBgZ2V0YCBhbmQgYHNldGAgbWV0aG9kJyk7XG4gIH1cblxuICBpZiAoX2NvbXBvbmVudC5zdHlsZSkge1xuICAgIHZhciBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7XG4gICAgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoX2NvbXBvbmVudC5zdHlsZSkpO1xuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICB9XG5cbiAgY29tcG9uZW50U3RvcmVbX2NvbXBvbmVudC5uYW1lXSA9IF9jb21wb25lbnQ7XG4gIHJldHVybiB0cnVlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDbGF5Q29uZmlnO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9IHJlcXVpcmUoJy4uL3ZlbmRvci9taW5pZmllZCcpLiQ7XG52YXIgXyA9IHJlcXVpcmUoJy4uL3ZlbmRvci9taW5pZmllZCcpLl87XG5cbi8qKlxuICogQXR0YWNoZXMgZXZlbnQgbWV0aG9kcyB0byB0aGUgY29udGV4dC5cbiAqIENhbGwgd2l0aCBDbGF5RXZlbnRzLmNhbGwoeW91ck9iamVjdCwgJGV2ZW50VGFyZ2V0KVxuICogQHBhcmFtIHtFdmVudEVtaXR0ZXJ8TX0gJGV2ZW50VGFyZ2V0IC0gQW4gb2JqZWN0IHRoYXQgd2lsbCBiZSB1c2VkIGFzIHRoZSBldmVudFxuICogdGFyZ2V0LiBNdXN0IGltcGxlbWVudCBFdmVudEVtaXR0ZXJcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDbGF5RXZlbnRzKCRldmVudFRhcmdldCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBfZXZlbnRQcm94aWVzID0gW107XG5cbiAgLyoqXG4gICAqIHByZWZpeGVzIGV2ZW50cyB3aXRoIFwifFwiXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudHNcbiAgICogQHJldHVybnMge3N0cmluZ31cbiAgICogQHByaXZhdGVcbiAgICovXG4gIGZ1bmN0aW9uIF90cmFuc2Zvcm1FdmVudE5hbWVzKGV2ZW50cykge1xuICAgIHJldHVybiBldmVudHMuc3BsaXQoJyAnKS5tYXAoZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgIHJldHVybiAnfCcgKyBldmVudC5yZXBsYWNlKC9eXFx8LywgJycpO1xuICAgIH0pLmpvaW4oJyAnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBoYW5kbGVyXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IHByb3h5XG4gICAqIEByZXR1cm5zIHtmdW5jdGlvbn1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIGZ1bmN0aW9uIF9yZWdpc3RlckV2ZW50UHJveHkoaGFuZGxlciwgcHJveHkpIHtcbiAgICB2YXIgZXZlbnRQcm94eSA9IF8uZmluZChfZXZlbnRQcm94aWVzLCBmdW5jdGlvbihpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5oYW5kbGVyID09PSBoYW5kbGVyID8gaXRlbSA6IG51bGw7XG4gICAgfSk7XG5cbiAgICBpZiAoIWV2ZW50UHJveHkpIHtcbiAgICAgIGV2ZW50UHJveHkgPSB7IGhhbmRsZXI6IGhhbmRsZXIsIHByb3h5OiBwcm94eSB9O1xuICAgICAgX2V2ZW50UHJveGllcy5wdXNoKGV2ZW50UHJveHkpO1xuICAgIH1cbiAgICByZXR1cm4gZXZlbnRQcm94eS5wcm94eTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBoYW5kbGVyXG4gICAqIEByZXR1cm5zIHtmdW5jdGlvbn1cbiAgICogQHByaXZhdGVcbiAgICovXG4gIGZ1bmN0aW9uIF9nZXRFdmVudFByb3h5KGhhbmRsZXIpIHtcbiAgICByZXR1cm4gXy5maW5kKF9ldmVudFByb3hpZXMsIGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgIHJldHVybiBpdGVtLmhhbmRsZXIgPT09IGhhbmRsZXIgPyBpdGVtLnByb3h5IDogbnVsbDtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBdHRhY2ggYW4gZXZlbnQgbGlzdGVuZXIgdG8gdGhlIGl0ZW0uXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudHMgLSBhIHNwYWNlIHNlcGFyYXRlZCBsaXN0IG9mIGV2ZW50c1xuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBoYW5kbGVyXG4gICAqIEByZXR1cm5zIHtDbGF5RXZlbnRzfVxuICAgKi9cbiAgc2VsZi5vbiA9IGZ1bmN0aW9uKGV2ZW50cywgaGFuZGxlcikge1xuICAgIHZhciBfZXZlbnRzID0gX3RyYW5zZm9ybUV2ZW50TmFtZXMoZXZlbnRzKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIF9wcm94eSA9IF9yZWdpc3RlckV2ZW50UHJveHkoaGFuZGxlciwgZnVuY3Rpb24oKSB7XG4gICAgICBoYW5kbGVyLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG4gICAgfSk7XG4gICAgJGV2ZW50VGFyZ2V0Lm9uKF9ldmVudHMsIF9wcm94eSk7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0aGUgZ2l2ZW4gZXZlbnQgaGFuZGxlci4gTk9URTogVGhpcyB3aWxsIHJlbW92ZSB0aGUgaGFuZGxlciBmcm9tIGFsbFxuICAgKiByZWdpc3RlcmVkIGV2ZW50c1xuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBoYW5kbGVyXG4gICAqIEByZXR1cm5zIHtDbGF5RXZlbnRzfVxuICAgKi9cbiAgc2VsZi5vZmYgPSBmdW5jdGlvbihoYW5kbGVyKSB7XG4gICAgdmFyIF9wcm94eSA9IF9nZXRFdmVudFByb3h5KGhhbmRsZXIpO1xuICAgIGlmIChfcHJveHkpIHtcbiAgICAgICQub2ZmKF9wcm94eSk7XG4gICAgfVxuICAgIHJldHVybiBzZWxmO1xuICB9O1xuXG4gIC8qKlxuICAgKiBUcmlnZ2VyIGFuIGV2ZW50LlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIGEgc2luZ2xlIGV2ZW50IG5hbWUgdG8gdHJpZ2dlclxuICAgKiBAcGFyYW0ge09iamVjdH0gW2V2ZW50T2JqXSAtIGFuIG9iamVjdCB0byBwYXNzIHRvIHRoZSBldmVudCBoYW5kbGVyLFxuICAgKiBwcm92aWRlZCB0aGUgaGFuZGxlciBkb2VzIG5vdCBoYXZlIGN1c3RvbSBhcmd1bWVudHMuXG4gICAqIEByZXR1cm5zIHtDbGF5RXZlbnRzfVxuICAgKi9cbiAgc2VsZi50cmlnZ2VyID0gZnVuY3Rpb24obmFtZSwgZXZlbnRPYmopIHtcbiAgICAkZXZlbnRUYXJnZXQudHJpZ2dlcihuYW1lLCBldmVudE9iaik7XG4gICAgcmV0dXJuIHNlbGY7XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xheUV2ZW50cztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNvbXBvbmVudFJlZ2lzdHJ5ID0gcmVxdWlyZSgnLi9jb21wb25lbnQtcmVnaXN0cnknKTtcbnZhciBtaW5pZmllZCA9IHJlcXVpcmUoJy4uL3ZlbmRvci9taW5pZmllZCcpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vbGliL3V0aWxzJyk7XG52YXIgQ2xheUV2ZW50cyA9IHJlcXVpcmUoJy4vY2xheS1ldmVudHMnKTtcblxudmFyIF8gPSBtaW5pZmllZC5fO1xudmFyIEhUTUwgPSBtaW5pZmllZC5IVE1MO1xuXG4vKipcbiAqIEBleHRlbmRzIENsYXlFdmVudHNcbiAqIEBwYXJhbSB7Q2xheX5Db25maWdJdGVtfSBjb25maWdcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDbGF5SXRlbShjb25maWcpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHZhciBfY29tcG9uZW50ID0gY29tcG9uZW50UmVnaXN0cnlbY29uZmlnLnR5cGVdO1xuXG4gIGlmICghX2NvbXBvbmVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhlIGNvbXBvbmVudDogJyArIGNvbmZpZy50eXBlICsgJyBpcyBub3QgcmVnaXN0ZXJlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdNYWtlIHN1cmUgdG8gcmVnaXN0ZXIgaXQgd2l0aCBDbGF5Q29uZmlnLnJlZ2lzdGVyQ29tcG9uZW50KCknKTtcbiAgfVxuXG4gIHZhciBfdGVtcGxhdGVEYXRhID0gXy5leHRlbmQoe30sIF9jb21wb25lbnQuZGVmYXVsdHMgfHwge30sIGNvbmZpZyk7XG5cbiAgLyoqIEB0eXBlIHtzdHJpbmd8bnVsbH0gKi9cbiAgc2VsZi5pZCA9IGNvbmZpZy5pZCB8fCBudWxsO1xuXG4gIC8qKiBAdHlwZSB7c3RyaW5nfG51bGx9ICovXG4gIHNlbGYubWVzc2FnZUtleSA9IGNvbmZpZy5tZXNzYWdlS2V5IHx8IG51bGw7XG5cbiAgLyoqIEB0eXBlIHtPYmplY3R9ICovXG4gIHNlbGYuY29uZmlnID0gY29uZmlnO1xuXG4gIC8qKiBAdHlwZSB7TX0gKi9cbiAgc2VsZi4kZWxlbWVudCA9IEhUTUwoX2NvbXBvbmVudC50ZW1wbGF0ZS50cmltKCksIF90ZW1wbGF0ZURhdGEpO1xuXG4gIC8qKiBAdHlwZSB7TX0gKi9cbiAgc2VsZi4kbWFuaXB1bGF0b3JUYXJnZXQgPSBzZWxmLiRlbGVtZW50LnNlbGVjdCgnW2RhdGEtbWFuaXB1bGF0b3ItdGFyZ2V0XScpO1xuXG4gIC8vIHRoaXMgY2F0ZXJzIGZvciBzaXR1YXRpb25zIHdoZXJlIHRoZSBtYW5pcHVsYXRvciB0YXJnZXQgaXMgdGhlIHJvb3QgZWxlbWVudFxuICBpZiAoIXNlbGYuJG1hbmlwdWxhdG9yVGFyZ2V0Lmxlbmd0aCkge1xuICAgIHNlbGYuJG1hbmlwdWxhdG9yVGFyZ2V0ID0gc2VsZi4kZWxlbWVudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSdW4gdGhlIGluaXRpYWxpemVyIGlmIGl0IGV4aXN0cyBhbmQgYXR0YWNoZXMgdGhlIGNzcyB0byB0aGUgaGVhZC5cbiAgICogUGFzc2VzIG1pbmlmaWVkIGFzIHRoZSBmaXJzdCBwYXJhbVxuICAgKiBAcGFyYW0ge0NsYXlDb25maWd9IGNsYXlcbiAgICogQHJldHVybnMge0NsYXlJdGVtfVxuICAgKi9cbiAgc2VsZi5pbml0aWFsaXplID0gZnVuY3Rpb24oY2xheSkge1xuICAgIGlmICh0eXBlb2YgX2NvbXBvbmVudC5pbml0aWFsaXplID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBfY29tcG9uZW50LmluaXRpYWxpemUuY2FsbChzZWxmLCBtaW5pZmllZCwgY2xheSk7XG4gICAgfVxuICAgIHJldHVybiBzZWxmO1xuICB9O1xuXG4gIC8vIGF0dGFjaCBldmVudCBtZXRob2RzXG4gIENsYXlFdmVudHMuY2FsbChzZWxmLCBzZWxmLiRtYW5pcHVsYXRvclRhcmdldCk7XG5cbiAgLy8gYXR0YWNoIHRoZSBtYW5pcHVsYXRvciBtZXRob2RzIHRvIHRoZSBjbGF5SXRlbVxuICBfLmVhY2hPYmooX2NvbXBvbmVudC5tYW5pcHVsYXRvciwgZnVuY3Rpb24obWV0aG9kTmFtZSwgbWV0aG9kKSB7XG4gICAgc2VsZlttZXRob2ROYW1lXSA9IG1ldGhvZC5iaW5kKHNlbGYpO1xuICB9KTtcblxuICAvLyBwcmV2ZW50IGV4dGVybmFsIG1vZGlmaWNhdGlvbnMgb2YgcHJvcGVydGllc1xuICB1dGlscy51cGRhdGVQcm9wZXJ0aWVzKHNlbGYsIHsgd3JpdGFibGU6IGZhbHNlLCBjb25maWd1cmFibGU6IGZhbHNlIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENsYXlJdGVtO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBtb2R1bGUgaXMgYmxhbmsgYmVjYXVzZSB3ZSBkeW5hbWljYWxseSBhZGQgY29tcG9uZW50c1xubW9kdWxlLmV4cG9ydHMgPSB7fTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIF8gPSByZXF1aXJlKCcuLi92ZW5kb3IvbWluaWZpZWQnKS5fO1xuXG4vKipcbiAqIEByZXR1cm5zIHtDbGF5SXRlbXxDbGF5RXZlbnRzfVxuICogQGV4dGVuZHMge0NsYXlJdGVtfVxuICovXG5mdW5jdGlvbiBkaXNhYmxlKCkge1xuICBpZiAodGhpcy4kbWFuaXB1bGF0b3JUYXJnZXQuZ2V0KCdkaXNhYmxlZCcpKSB7IHJldHVybiB0aGlzOyB9XG4gIHRoaXMuJGVsZW1lbnQuc2V0KCcrZGlzYWJsZWQnKTtcbiAgdGhpcy4kbWFuaXB1bGF0b3JUYXJnZXQuc2V0KCdkaXNhYmxlZCcsIHRydWUpO1xuICByZXR1cm4gdGhpcy50cmlnZ2VyKCdkaXNhYmxlZCcpO1xufVxuXG4vKipcbiAqIEByZXR1cm5zIHtDbGF5SXRlbXxDbGF5RXZlbnRzfVxuICogQGV4dGVuZHMge0NsYXlJdGVtfVxuICovXG5mdW5jdGlvbiBlbmFibGUoKSB7XG4gIGlmICghdGhpcy4kbWFuaXB1bGF0b3JUYXJnZXQuZ2V0KCdkaXNhYmxlZCcpKSB7IHJldHVybiB0aGlzOyB9XG4gIHRoaXMuJGVsZW1lbnQuc2V0KCctZGlzYWJsZWQnKTtcbiAgdGhpcy4kbWFuaXB1bGF0b3JUYXJnZXQuc2V0KCdkaXNhYmxlZCcsIGZhbHNlKTtcbiAgcmV0dXJuIHRoaXMudHJpZ2dlcignZW5hYmxlZCcpO1xufVxuXG4vKipcbiAqIEByZXR1cm5zIHtDbGF5SXRlbXxDbGF5RXZlbnRzfVxuICogQGV4dGVuZHMge0NsYXlJdGVtfVxuICovXG5mdW5jdGlvbiBoaWRlKCkge1xuICBpZiAodGhpcy4kZWxlbWVudFswXS5jbGFzc0xpc3QuY29udGFpbnMoJ2hpZGUnKSkgeyByZXR1cm4gdGhpczsgfVxuICB0aGlzLiRlbGVtZW50LnNldCgnK2hpZGUnKTtcbiAgcmV0dXJuIHRoaXMudHJpZ2dlcignaGlkZScpO1xufVxuXG4vKipcbiAqIEByZXR1cm5zIHtDbGF5SXRlbXxDbGF5RXZlbnRzfVxuICogQGV4dGVuZHMge0NsYXlJdGVtfVxuICovXG5mdW5jdGlvbiBzaG93KCkge1xuICBpZiAoIXRoaXMuJGVsZW1lbnRbMF0uY2xhc3NMaXN0LmNvbnRhaW5zKCdoaWRlJykpIHsgcmV0dXJuIHRoaXM7IH1cbiAgdGhpcy4kZWxlbWVudC5zZXQoJy1oaWRlJyk7XG4gIHJldHVybiB0aGlzLnRyaWdnZXIoJ3Nob3cnKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGh0bWw6IHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuJG1hbmlwdWxhdG9yVGFyZ2V0LmdldCgnaW5uZXJIVE1MJyk7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBpZiAodGhpcy5nZXQoKSA9PT0gdmFsdWUudG9TdHJpbmcoMTApKSB7IHJldHVybiB0aGlzOyB9XG4gICAgICB0aGlzLiRtYW5pcHVsYXRvclRhcmdldC5zZXQoJ2lubmVySFRNTCcsIHZhbHVlKTtcbiAgICAgIHJldHVybiB0aGlzLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgIH0sXG4gICAgaGlkZTogaGlkZSxcbiAgICBzaG93OiBzaG93XG4gIH0sXG4gIGJ1dHRvbjoge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy4kbWFuaXB1bGF0b3JUYXJnZXQuZ2V0KCdpbm5lckhUTUwnKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGlmICh0aGlzLmdldCgpID09PSB2YWx1ZS50b1N0cmluZygxMCkpIHsgcmV0dXJuIHRoaXM7IH1cbiAgICAgIHRoaXMuJG1hbmlwdWxhdG9yVGFyZ2V0LnNldCgnaW5uZXJIVE1MJywgdmFsdWUpO1xuICAgICAgcmV0dXJuIHRoaXMudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgfSxcbiAgICBkaXNhYmxlOiBkaXNhYmxlLFxuICAgIGVuYWJsZTogZW5hYmxlLFxuICAgIGhpZGU6IGhpZGUsXG4gICAgc2hvdzogc2hvd1xuICB9LFxuICB2YWw6IHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuJG1hbmlwdWxhdG9yVGFyZ2V0LmdldCgndmFsdWUnKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGlmICh0aGlzLmdldCgpID09PSB2YWx1ZS50b1N0cmluZygxMCkpIHsgcmV0dXJuIHRoaXM7IH1cbiAgICAgIHRoaXMuJG1hbmlwdWxhdG9yVGFyZ2V0LnNldCgndmFsdWUnLCB2YWx1ZSk7XG4gICAgICByZXR1cm4gdGhpcy50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICB9LFxuICAgIGRpc2FibGU6IGRpc2FibGUsXG4gICAgZW5hYmxlOiBlbmFibGUsXG4gICAgaGlkZTogaGlkZSxcbiAgICBzaG93OiBzaG93XG4gIH0sXG4gIHNsaWRlcjoge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gcGFyc2VGbG9hdCh0aGlzLiRtYW5pcHVsYXRvclRhcmdldC5nZXQoJ3ZhbHVlJykpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgdmFyIGluaXRWYWwgPSB0aGlzLmdldCgpO1xuICAgICAgdGhpcy4kbWFuaXB1bGF0b3JUYXJnZXQuc2V0KCd2YWx1ZScsIHZhbHVlKTtcbiAgICAgIGlmICh0aGlzLmdldCgpID09PSBpbml0VmFsKSB7IHJldHVybiB0aGlzOyB9XG4gICAgICByZXR1cm4gdGhpcy50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICB9LFxuICAgIGRpc2FibGU6IGRpc2FibGUsXG4gICAgZW5hYmxlOiBlbmFibGUsXG4gICAgaGlkZTogaGlkZSxcbiAgICBzaG93OiBzaG93XG4gIH0sXG4gIGNoZWNrZWQ6IHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuJG1hbmlwdWxhdG9yVGFyZ2V0LmdldCgnY2hlY2tlZCcpO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgaWYgKCF0aGlzLmdldCgpID09PSAhdmFsdWUpIHsgcmV0dXJuIHRoaXM7IH1cbiAgICAgIHRoaXMuJG1hbmlwdWxhdG9yVGFyZ2V0LnNldCgnY2hlY2tlZCcsICEhdmFsdWUpO1xuICAgICAgcmV0dXJuIHRoaXMudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgfSxcbiAgICBkaXNhYmxlOiBkaXNhYmxlLFxuICAgIGVuYWJsZTogZW5hYmxlLFxuICAgIGhpZGU6IGhpZGUsXG4gICAgc2hvdzogc2hvd1xuICB9LFxuICByYWRpb2dyb3VwOiB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLiRlbGVtZW50LnNlbGVjdCgnaW5wdXQ6Y2hlY2tlZCcpLmdldCgndmFsdWUnKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGlmICh0aGlzLmdldCgpID09PSB2YWx1ZS50b1N0cmluZygxMCkpIHsgcmV0dXJuIHRoaXM7IH1cbiAgICAgIHRoaXMuJGVsZW1lbnRcbiAgICAgICAgLnNlbGVjdCgnaW5wdXRbdmFsdWU9XCInICsgdmFsdWUucmVwbGFjZSgnXCInLCAnXFxcXFwiJykgKyAnXCJdJylcbiAgICAgICAgLnNldCgnY2hlY2tlZCcsIHRydWUpO1xuICAgICAgcmV0dXJuIHRoaXMudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgfSxcbiAgICBkaXNhYmxlOiBkaXNhYmxlLFxuICAgIGVuYWJsZTogZW5hYmxlLFxuICAgIGhpZGU6IGhpZGUsXG4gICAgc2hvdzogc2hvd1xuICB9LFxuICBjaGVja2JveGdyb3VwOiB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgIHRoaXMuJGVsZW1lbnQuc2VsZWN0KCdpbnB1dCcpLmVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICByZXN1bHQucHVzaCghIWl0ZW0uY2hlY2tlZCk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlcykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFsdWVzID0gQXJyYXkuaXNBcnJheSh2YWx1ZXMpID8gdmFsdWVzIDogW107XG5cbiAgICAgIHdoaWxlICh2YWx1ZXMubGVuZ3RoIDwgdGhpcy5nZXQoKS5sZW5ndGgpIHtcbiAgICAgICAgdmFsdWVzLnB1c2goZmFsc2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAoXy5lcXVhbHModGhpcy5nZXQoKSwgdmFsdWVzKSkgeyByZXR1cm4gdGhpczsgfVxuXG4gICAgICBzZWxmLiRlbGVtZW50LnNlbGVjdCgnaW5wdXQnKVxuICAgICAgICAuc2V0KCdjaGVja2VkJywgZmFsc2UpXG4gICAgICAgIC5lYWNoKGZ1bmN0aW9uKGl0ZW0sIGluZGV4KSB7XG4gICAgICAgICAgaXRlbS5jaGVja2VkID0gISF2YWx1ZXNbaW5kZXhdO1xuICAgICAgICB9KTtcblxuICAgICAgcmV0dXJuIHNlbGYudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgfSxcbiAgICBkaXNhYmxlOiBkaXNhYmxlLFxuICAgIGVuYWJsZTogZW5hYmxlLFxuICAgIGhpZGU6IGhpZGUsXG4gICAgc2hvdzogc2hvd1xuICB9LFxuICBjb2xvcjoge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gcGFyc2VJbnQodGhpcy4kbWFuaXB1bGF0b3JUYXJnZXQuZ2V0KCd2YWx1ZScpLCAxMCkgfHwgMDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHZhbHVlID0gdGhpcy5yb3VuZENvbG9yVG9MYXlvdXQodmFsdWUgfHwgMCk7XG5cbiAgICAgIGlmICh0aGlzLmdldCgpID09PSB2YWx1ZSkgeyByZXR1cm4gdGhpczsgfVxuICAgICAgdGhpcy4kbWFuaXB1bGF0b3JUYXJnZXQuc2V0KCd2YWx1ZScsIHZhbHVlKTtcbiAgICAgIHJldHVybiB0aGlzLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgIH0sXG4gICAgZGlzYWJsZTogZGlzYWJsZSxcbiAgICBlbmFibGU6IGVuYWJsZSxcbiAgICBoaWRlOiBoaWRlLFxuICAgIHNob3c6IHNob3dcbiAgfVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBCYXRjaCB1cGRhdGUgYWxsIHRoZSBwcm9wZXJ0aWVzIG9mIGFuIG9iamVjdC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEBwYXJhbSB7T2JqZWN0fSBkZXNjcmlwdG9yXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZV1cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW2Rlc2NyaXB0b3IuZW51bWVyYWJsZV1cbiAqIEBwYXJhbSB7Kn0gW2Rlc2NyaXB0b3IudmFsdWVdXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXNjcmlwdG9yLndyaXRhYmxlXVxuICogQHBhcmFtIHtmdW5jdGlvbn0gW2Rlc2NyaXB0b3IuZ2V0XVxuICogQHBhcmFtIHtmdW5jdGlvbn0gW2Rlc2NyaXB0b3Iuc2V0XVxuICogQHJldHVybiB7dm9pZH1cbiAqL1xubW9kdWxlLmV4cG9ydHMudXBkYXRlUHJvcGVydGllcyA9IGZ1bmN0aW9uKG9iaiwgZGVzY3JpcHRvcikge1xuICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhvYmopLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIHByb3AsIGRlc2NyaXB0b3IpO1xuICB9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmNhcGFiaWxpdHlNYXAgPSB7XG4gIFBMQVRGT1JNX0FQTElURToge1xuICAgIHBsYXRmb3JtczogWydhcGxpdGUnXSxcbiAgICBtaW5Gd01ham9yOiAwLFxuICAgIG1pbkZ3TWlub3I6IDBcbiAgfSxcbiAgUExBVEZPUk1fQkFTQUxUOiB7XG4gICAgcGxhdGZvcm1zOiBbJ2Jhc2FsdCddLFxuICAgIG1pbkZ3TWFqb3I6IDAsXG4gICAgbWluRndNaW5vcjogMFxuICB9LFxuICBQTEFURk9STV9DSEFMSzoge1xuICAgIHBsYXRmb3JtczogWydjaGFsayddLFxuICAgIG1pbkZ3TWFqb3I6IDAsXG4gICAgbWluRndNaW5vcjogMFxuICB9LFxuICBQTEFURk9STV9ESU9SSVRFOiB7XG4gICAgcGxhdGZvcm1zOiBbJ2Rpb3JpdGUnXSxcbiAgICBtaW5Gd01ham9yOiAwLFxuICAgIG1pbkZ3TWlub3I6IDBcbiAgfSxcbiAgUExBVEZPUk1fRU1FUlk6IHtcbiAgICBwbGF0Zm9ybXM6IFsnZW1lcnknXSxcbiAgICBtaW5Gd01ham9yOiAwLFxuICAgIG1pbkZ3TWlub3I6IDBcbiAgfSxcbiAgQlc6IHtcbiAgICBwbGF0Zm9ybXM6IFsnYXBsaXRlJywgJ2Rpb3JpdGUnXSxcbiAgICBtaW5Gd01ham9yOiAwLFxuICAgIG1pbkZ3TWlub3I6IDBcbiAgfSxcbiAgQ09MT1I6IHtcbiAgICBwbGF0Zm9ybXM6IFsnYmFzYWx0JywgJ2NoYWxrJywgJ2VtZXJ5J10sXG4gICAgbWluRndNYWpvcjogMCxcbiAgICBtaW5Gd01pbm9yOiAwXG4gIH0sXG4gIE1JQ1JPUEhPTkU6IHtcbiAgICBwbGF0Zm9ybXM6IFsnYmFzYWx0JywgJ2NoYWxrJywgJ2Rpb3JpdGUnLCAnZW1lcnknXSxcbiAgICBtaW5Gd01ham9yOiAwLFxuICAgIG1pbkZ3TWlub3I6IDBcbiAgfSxcbiAgU01BUlRTVFJBUDoge1xuICAgIHBsYXRmb3JtczogWydiYXNhbHQnLCAnY2hhbGsnLCAnZGlvcml0ZScsICdlbWVyeSddLFxuICAgIG1pbkZ3TWFqb3I6IDMsXG4gICAgbWluRndNaW5vcjogNFxuICB9LFxuICBTTUFSVFNUUkFQX1BPV0VSOiB7XG4gICAgcGxhdGZvcm1zOiBbJ2Jhc2FsdCcsICdjaGFsaycsICdlbWVyeSddLFxuICAgIG1pbkZ3TWFqb3I6IDMsXG4gICAgbWluRndNaW5vcjogNFxuICB9LFxuICBIRUFMVEg6IHtcbiAgICBwbGF0Zm9ybXM6IFsnYmFzYWx0JywgJ2NoYWxrJywgJ2Rpb3JpdGUnLCAnZW1lcnknXSxcbiAgICBtaW5Gd01ham9yOiAzLFxuICAgIG1pbkZ3TWlub3I6IDEwXG4gIH0sXG4gIFJFQ1Q6IHtcbiAgICBwbGF0Zm9ybXM6IFsnYXBsaXRlJywgJ2Jhc2FsdCcsICdkaW9yaXRlJywgJ2VtZXJ5J10sXG4gICAgbWluRndNYWpvcjogMCxcbiAgICBtaW5Gd01pbm9yOiAwXG4gIH0sXG4gIFJPVU5EOiB7XG4gICAgcGxhdGZvcm1zOiBbJ2NoYWxrJ10sXG4gICAgbWluRndNYWpvcjogMCxcbiAgICBtaW5Gd01pbm9yOiAwXG4gIH0sXG4gIERJU1BMQVlfMTQ0eDE2ODoge1xuICAgIHBsYXRmb3JtczogWydhcGxpdGUnLCAnYmFzYWx0JywgJ2Rpb3JpdGUnXSxcbiAgICBtaW5Gd01ham9yOiAwLFxuICAgIG1pbkZ3TWlub3I6IDBcbiAgfSxcbiAgRElTUExBWV8xODB4MTgwX1JPVU5EOiB7XG4gICAgcGxhdGZvcm1zOiBbJ2NoYWxrJ10sXG4gICAgbWluRndNYWpvcjogMCxcbiAgICBtaW5Gd01pbm9yOiAwXG4gIH0sXG4gIERJU1BMQVlfMjAweDIyODoge1xuICAgIHBsYXRmb3JtczogWydlbWVyeSddLFxuICAgIG1pbkZ3TWFqb3I6IDAsXG4gICAgbWluRndNaW5vcjogMFxuICB9XG59O1xuXG4vKipcbiAqIENoZWNrcyBpZiBhbGwgb2YgdGhlIHByb3ZpZGVkIGNhcGFiaWxpdGllcyBhcmUgY29tcGF0aWJsZSB3aXRoIHRoZSB3YXRjaFxuICogQHBhcmFtIHtPYmplY3R9IGFjdGl2ZVdhdGNoSW5mb1xuICogQHBhcmFtIHtBcnJheTxzdHJpbmc+fSBbY2FwYWJpbGl0aWVzXVxuICogQHJldHVybiB7Ym9vbGVhbn1cbiAqL1xubW9kdWxlLmV4cG9ydHMuaW5jbHVkZXNDYXBhYmlsaXR5ID0gZnVuY3Rpb24oYWN0aXZlV2F0Y2hJbmZvLCBjYXBhYmlsaXRpZXMpIHtcbiAgdmFyIG5vdFJlZ2V4ID0gL15OT1RfLztcbiAgdmFyIHJlc3VsdCA9IFtdO1xuXG4gIGlmICghY2FwYWJpbGl0aWVzIHx8ICFjYXBhYmlsaXRpZXMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmb3IgKHZhciBpID0gY2FwYWJpbGl0aWVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgdmFyIGNhcGFiaWxpdHkgPSBjYXBhYmlsaXRpZXNbaV07XG4gICAgdmFyIG1hcHBpbmcgPSBtb2R1bGUuZXhwb3J0cy5jYXBhYmlsaXR5TWFwW2NhcGFiaWxpdHkucmVwbGFjZShub3RSZWdleCwgJycpXTtcblxuICAgIGlmICghbWFwcGluZyB8fFxuICAgICAgICBtYXBwaW5nLnBsYXRmb3Jtcy5pbmRleE9mKGFjdGl2ZVdhdGNoSW5mby5wbGF0Zm9ybSkgPT09IC0xIHx8XG4gICAgICAgIG1hcHBpbmcubWluRndNYWpvciA+IGFjdGl2ZVdhdGNoSW5mby5maXJtd2FyZS5tYWpvciB8fFxuICAgICAgICBtYXBwaW5nLm1pbkZ3TWFqb3IgPT09IGFjdGl2ZVdhdGNoSW5mby5maXJtd2FyZS5tYWpvciAmJlxuICAgICAgICBtYXBwaW5nLm1pbkZ3TWlub3IgPiBhY3RpdmVXYXRjaEluZm8uZmlybXdhcmUubWlub3JcbiAgICApIHtcbiAgICAgIHJlc3VsdC5wdXNoKCEhY2FwYWJpbGl0eS5tYXRjaChub3RSZWdleCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQucHVzaCghY2FwYWJpbGl0eS5tYXRjaChub3RSZWdleCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQuaW5kZXhPZihmYWxzZSkgPT09IC0xO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBfd2luZG93ID0gd2luZG93O1xuICAgIHZhciBNSU5JRklFRF9NQUdJQ19OT0RFSUQgPSAnTmlhJztcbiAgICB2YXIgTUlOSUZJRURfTUFHSUNfUFJFViA9ICdOaWFQJztcbiAgICB2YXIgc2V0dGVyID0ge30sIGdldHRlciA9IHt9O1xuICAgIHZhciBpZFNlcXVlbmNlID0gMTtcbiAgICB2YXIgRE9NUkVBRFlfSEFORExFUiA9IC9eW2ljXS8udGVzdChkb2N1bWVudFsncmVhZHlTdGF0ZSddKSA/IF9udWxsIDogW107XG4gICAgdmFyIF9udWxsID0gbnVsbDtcbiAgICB2YXIgdW5kZWY7XG4gICAgZnVuY3Rpb24gdmFsMyh2KSB7XG4gICAgICAgIHJldHVybiB2LnN1YnN0cigwLCAzKTtcbiAgICB9XG4gICAgdmFyIE1PTlRIX0xPTkdfTkFNRVMgPSBzcGxpdCgnSmFudWFyeSxGZWJydWFyeSxNYXJjaCxBcHJpbCxNYXksSnVuZSxKdWx5LEF1Z3VzdCxTZXB0ZW1iZXIsT2N0b2JlcixOb3ZlbWJlcixEZWNlbWJlcicsIC8sL2cpO1xuICAgIHZhciBNT05USF9TSE9SVF9OQU1FUyA9IG1hcChNT05USF9MT05HX05BTUVTLCB2YWwzKTtcbiAgICB2YXIgV0VFS19MT05HX05BTUVTID0gc3BsaXQoJ1N1bmRheSxNb25kYXksVHVlc2RheSxXZWRuZXNkYXksVGh1cnNkYXksRnJpZGF5LFNhdHVyZGF5JywgLywvZyk7XG4gICAgdmFyIFdFRUtfU0hPUlRfTkFNRVMgPSBtYXAoV0VFS19MT05HX05BTUVTLCB2YWwzKTtcbiAgICB2YXIgTUVSSURJQU5fTkFNRVMgPSBzcGxpdCgnYW0scG0nLCAvLC9nKTtcbiAgICB2YXIgTUVSSURJQU5fTkFNRVNfRlVMTCA9IHNwbGl0KCdhbSxhbSxhbSxhbSxhbSxhbSxhbSxhbSxhbSxhbSxhbSxhbSxwbSxwbSxwbSxwbSxwbSxwbSxwbSxwbSxwbSxwbSxwbSxwbScsIC8sL2cpO1xuICAgIHZhciBGT1JNQVRfREFURV9NQVAgPSB7XG4gICAgICAgICd5JzogW1xuICAgICAgICAgICAgJ0Z1bGxZZWFyJyxcbiAgICAgICAgICAgIG5vbk9wXG4gICAgICAgIF0sXG4gICAgICAgICdZJzogW1xuICAgICAgICAgICAgJ0Z1bGxZZWFyJyxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGQgJSAxMDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIF0sXG4gICAgICAgICdNJzogW1xuICAgICAgICAgICAgJ01vbnRoJyxcbiAgICAgICAgICAgIHBsdXNPbmVcbiAgICAgICAgXSxcbiAgICAgICAgJ24nOiBbXG4gICAgICAgICAgICAnTW9udGgnLFxuICAgICAgICAgICAgTU9OVEhfU0hPUlRfTkFNRVNcbiAgICAgICAgXSxcbiAgICAgICAgJ04nOiBbXG4gICAgICAgICAgICAnTW9udGgnLFxuICAgICAgICAgICAgTU9OVEhfTE9OR19OQU1FU1xuICAgICAgICBdLFxuICAgICAgICAnZCc6IFtcbiAgICAgICAgICAgICdEYXRlJyxcbiAgICAgICAgICAgIG5vbk9wXG4gICAgICAgIF0sXG4gICAgICAgICdtJzogW1xuICAgICAgICAgICAgJ01pbnV0ZXMnLFxuICAgICAgICAgICAgbm9uT3BcbiAgICAgICAgXSxcbiAgICAgICAgJ0gnOiBbXG4gICAgICAgICAgICAnSG91cnMnLFxuICAgICAgICAgICAgbm9uT3BcbiAgICAgICAgXSxcbiAgICAgICAgJ2gnOiBbXG4gICAgICAgICAgICAnSG91cnMnLFxuICAgICAgICAgICAgZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZCAlIDEyIHx8IDEyO1xuICAgICAgICAgICAgfVxuICAgICAgICBdLFxuICAgICAgICAnayc6IFtcbiAgICAgICAgICAgICdIb3VycycsXG4gICAgICAgICAgICBwbHVzT25lXG4gICAgICAgIF0sXG4gICAgICAgICdLJzogW1xuICAgICAgICAgICAgJ0hvdXJzJyxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGQgJSAxMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXSxcbiAgICAgICAgJ3MnOiBbXG4gICAgICAgICAgICAnU2Vjb25kcycsXG4gICAgICAgICAgICBub25PcFxuICAgICAgICBdLFxuICAgICAgICAnUyc6IFtcbiAgICAgICAgICAgICdNaWxsaXNlY29uZHMnLFxuICAgICAgICAgICAgbm9uT3BcbiAgICAgICAgXSxcbiAgICAgICAgJ2EnOiBbXG4gICAgICAgICAgICAnSG91cnMnLFxuICAgICAgICAgICAgTUVSSURJQU5fTkFNRVNfRlVMTFxuICAgICAgICBdLFxuICAgICAgICAndyc6IFtcbiAgICAgICAgICAgICdEYXknLFxuICAgICAgICAgICAgV0VFS19TSE9SVF9OQU1FU1xuICAgICAgICBdLFxuICAgICAgICAnVyc6IFtcbiAgICAgICAgICAgICdEYXknLFxuICAgICAgICAgICAgV0VFS19MT05HX05BTUVTXG4gICAgICAgIF0sXG4gICAgICAgICd6JzogW1xuICAgICAgICAgICAgJ1RpbWV6b25lT2Zmc2V0JyxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChkLCBkdW1teSwgdGltZXpvbmUpIHtcbiAgICAgICAgICAgICAgICBpZiAodGltZXpvbmUpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aW1lem9uZTtcbiAgICAgICAgICAgICAgICB2YXIgc2lnbiA9IGQgPiAwID8gJy0nIDogJysnO1xuICAgICAgICAgICAgICAgIHZhciBvZmYgPSBkIDwgMCA/IC1kIDogZDtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2lnbiArIHBhZCgyLCBNYXRoLmZsb29yKG9mZiAvIDYwKSkgKyBwYWQoMiwgb2ZmICUgNjApO1xuICAgICAgICAgICAgfVxuICAgICAgICBdXG4gICAgfTtcbiAgICB2YXIgUEFSU0VfREFURV9NQVAgPSB7XG4gICAgICAgICd5JzogMCxcbiAgICAgICAgJ1knOiBbXG4gICAgICAgICAgICAwLFxuICAgICAgICAgICAgLTIwMDBcbiAgICAgICAgXSxcbiAgICAgICAgJ00nOiBbXG4gICAgICAgICAgICAxLFxuICAgICAgICAgICAgMVxuICAgICAgICBdLFxuICAgICAgICAnbic6IFtcbiAgICAgICAgICAgIDEsXG4gICAgICAgICAgICBNT05USF9TSE9SVF9OQU1FU1xuICAgICAgICBdLFxuICAgICAgICAnTic6IFtcbiAgICAgICAgICAgIDEsXG4gICAgICAgICAgICBNT05USF9MT05HX05BTUVTXG4gICAgICAgIF0sXG4gICAgICAgICdkJzogMixcbiAgICAgICAgJ20nOiA0LFxuICAgICAgICAnSCc6IDMsXG4gICAgICAgICdoJzogMyxcbiAgICAgICAgJ0snOiBbXG4gICAgICAgICAgICAzLFxuICAgICAgICAgICAgMVxuICAgICAgICBdLFxuICAgICAgICAnayc6IFtcbiAgICAgICAgICAgIDMsXG4gICAgICAgICAgICAxXG4gICAgICAgIF0sXG4gICAgICAgICdzJzogNSxcbiAgICAgICAgJ1MnOiA2LFxuICAgICAgICAnYSc6IFtcbiAgICAgICAgICAgIDMsXG4gICAgICAgICAgICBNRVJJRElBTl9OQU1FU1xuICAgICAgICBdXG4gICAgfTtcbiAgICB2YXIgTUFYX0NBQ0hFRF9URU1QTEFURVMgPSA5OTtcbiAgICB2YXIgdGVtcGxhdGVDYWNoZSA9IHt9O1xuICAgIHZhciB0ZW1wbGF0ZXMgPSBbXTtcbiAgICBmdW5jdGlvbiB0b1N0cmluZyhzKSB7XG4gICAgICAgIHJldHVybiBzICE9IF9udWxsID8gJycgKyBzIDogJyc7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzVHlwZShzLCBvKSB7XG4gICAgICAgIHJldHVybiB0eXBlb2YgcyA9PSBvO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc1N0cmluZyhzKSB7XG4gICAgICAgIHJldHVybiBpc1R5cGUocywgJ3N0cmluZycpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc09iamVjdChmKSB7XG4gICAgICAgIHJldHVybiAhIWYgJiYgaXNUeXBlKGYsICdvYmplY3QnKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNOb2RlKG4pIHtcbiAgICAgICAgcmV0dXJuIG4gJiYgblsnbm9kZVR5cGUnXTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNOdW1iZXIobikge1xuICAgICAgICByZXR1cm4gaXNUeXBlKG4sICdudW1iZXInKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNEYXRlKG4pIHtcbiAgICAgICAgcmV0dXJuIGlzT2JqZWN0KG4pICYmICEhblsnZ2V0RGF5J107XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzQm9vbChuKSB7XG4gICAgICAgIHJldHVybiBuID09PSB0cnVlIHx8IG4gPT09IGZhbHNlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc1ZhbHVlKG4pIHtcbiAgICAgICAgdmFyIHR5cGUgPSB0eXBlb2YgbjtcbiAgICAgICAgcmV0dXJuIHR5cGUgPT0gJ29iamVjdCcgPyAhIShuICYmIG5bJ2dldERheSddKSA6IHR5cGUgPT0gJ3N0cmluZycgfHwgdHlwZSA9PSAnbnVtYmVyJyB8fCBpc0Jvb2wobik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG5vbk9wKHYpIHtcbiAgICAgICAgcmV0dXJuIHY7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHBsdXNPbmUoZCkge1xuICAgICAgICByZXR1cm4gZCArIDE7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlcGxhY2UocywgcmVnZXhwLCBzdWIpIHtcbiAgICAgICAgcmV0dXJuIHRvU3RyaW5nKHMpLnJlcGxhY2UocmVnZXhwLCBzdWIgIT0gX251bGwgPyBzdWIgOiAnJyk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGVzY2FwZVJlZ0V4cChzKSB7XG4gICAgICAgIHJldHVybiByZXBsYWNlKHMsIC9bXFxcXFxcW1xcXVxcL3t9KCkqKz8uJHxeLV0vZywgJ1xcXFwkJicpO1xuICAgIH1cbiAgICBmdW5jdGlvbiB0cmltKHMpIHtcbiAgICAgICAgcmV0dXJuIHJlcGxhY2UocywgL15cXHMrfFxccyskL2cpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBlYWNoT2JqKG9iaiwgY2IsIGN0eCkge1xuICAgICAgICBmb3IgKHZhciBuIGluIG9iailcbiAgICAgICAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkobikpXG4gICAgICAgICAgICAgICAgY2IuY2FsbChjdHggfHwgb2JqLCBuLCBvYmpbbl0pO1xuICAgICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICBmdW5jdGlvbiBlYWNoKGxpc3QsIGNiLCBjdHgpIHtcbiAgICAgICAgaWYgKGxpc3QpXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICAgICAgY2IuY2FsbChjdHggfHwgbGlzdCwgbGlzdFtpXSwgaSk7XG4gICAgICAgIHJldHVybiBsaXN0O1xuICAgIH1cbiAgICBmdW5jdGlvbiBmaWx0ZXIobGlzdCwgZmlsdGVyRnVuY09yT2JqZWN0LCBjdHgpIHtcbiAgICAgICAgdmFyIHIgPSBbXTtcbiAgICAgICAgdmFyIGYgPSBpc0Z1bmN0aW9uKGZpbHRlckZ1bmNPck9iamVjdCkgPyBmaWx0ZXJGdW5jT3JPYmplY3QgOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiBmaWx0ZXJGdW5jT3JPYmplY3QgIT0gdmFsdWU7XG4gICAgICAgIH07XG4gICAgICAgIGVhY2gobGlzdCwgZnVuY3Rpb24gKHZhbHVlLCBpbmRleCkge1xuICAgICAgICAgICAgaWYgKGYuY2FsbChjdHggfHwgbGlzdCwgdmFsdWUsIGluZGV4KSlcbiAgICAgICAgICAgICAgICByLnB1c2godmFsdWUpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNvbGxlY3RvcihpdGVyYXRvciwgb2JqLCBjb2xsZWN0RnVuYywgY3R4KSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgaXRlcmF0b3Iob2JqLCBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgaWYgKGlzTGlzdChhID0gY29sbGVjdEZ1bmMuY2FsbChjdHggfHwgb2JqLCBhLCBiKSkpXG4gICAgICAgICAgICAgICAgZWFjaChhLCBmdW5jdGlvbiAocnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gocnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZWxzZSBpZiAoYSAhPSBfbnVsbClcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaChhKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNvbGxlY3RPYmoob2JqLCBjb2xsZWN0RnVuYywgY3R4KSB7XG4gICAgICAgIHJldHVybiBjb2xsZWN0b3IoZWFjaE9iaiwgb2JqLCBjb2xsZWN0RnVuYywgY3R4KTtcbiAgICB9XG4gICAgZnVuY3Rpb24gY29sbGVjdChsaXN0LCBjb2xsZWN0RnVuYywgY3R4KSB7XG4gICAgICAgIHJldHVybiBjb2xsZWN0b3IoZWFjaCwgbGlzdCwgY29sbGVjdEZ1bmMsIGN0eCk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGtleUNvdW50KG9iaikge1xuICAgICAgICB2YXIgYyA9IDA7XG4gICAgICAgIGVhY2hPYmoob2JqLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICBjKys7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gYztcbiAgICB9XG4gICAgZnVuY3Rpb24ga2V5cyhvYmopIHtcbiAgICAgICAgdmFyIGxpc3QgPSBbXTtcbiAgICAgICAgZWFjaE9iaihvYmosIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIGxpc3QucHVzaChrZXkpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGxpc3Q7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG1hcChsaXN0LCBtYXBGdW5jLCBjdHgpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgICBlYWNoKGxpc3QsIGZ1bmN0aW9uIChpdGVtLCBpbmRleCkge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2gobWFwRnVuYy5jYWxsKGN0eCB8fCBsaXN0LCBpdGVtLCBpbmRleCkpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgZnVuY3Rpb24gc3RhcnRzV2l0aChiYXNlLCBzdGFydCkge1xuICAgICAgICBpZiAoaXNMaXN0KGJhc2UpKSB7XG4gICAgICAgICAgICB2YXIgczIgPSBfKHN0YXJ0KTtcbiAgICAgICAgICAgIHJldHVybiBlcXVhbHMoc3ViKGJhc2UsIDAsIHMyLmxlbmd0aCksIHMyKTtcbiAgICAgICAgfSBlbHNlXG4gICAgICAgICAgICByZXR1cm4gc3RhcnQgIT0gX251bGwgJiYgYmFzZS5zdWJzdHIoMCwgc3RhcnQubGVuZ3RoKSA9PSBzdGFydDtcbiAgICB9XG4gICAgZnVuY3Rpb24gZW5kc1dpdGgoYmFzZSwgZW5kKSB7XG4gICAgICAgIGlmIChpc0xpc3QoYmFzZSkpIHtcbiAgICAgICAgICAgIHZhciBlMiA9IF8oZW5kKTtcbiAgICAgICAgICAgIHJldHVybiBlcXVhbHMoc3ViKGJhc2UsIC1lMi5sZW5ndGgpLCBlMikgfHwgIWUyLmxlbmd0aDtcbiAgICAgICAgfSBlbHNlXG4gICAgICAgICAgICByZXR1cm4gZW5kICE9IF9udWxsICYmIGJhc2Uuc3Vic3RyKGJhc2UubGVuZ3RoIC0gZW5kLmxlbmd0aCkgPT0gZW5kO1xuICAgIH1cbiAgICBmdW5jdGlvbiByZXZlcnNlKGxpc3QpIHtcbiAgICAgICAgdmFyIGxlbiA9IGxpc3QubGVuZ3RoO1xuICAgICAgICBpZiAoaXNMaXN0KGxpc3QpKVxuICAgICAgICAgICAgcmV0dXJuIG5ldyBNKG1hcChsaXN0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxpc3RbLS1sZW5dO1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICByZXR1cm4gcmVwbGFjZShsaXN0LCAvW1xcc1xcU10vZywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBsaXN0LmNoYXJBdCgtLWxlbik7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG4gICAgZnVuY3Rpb24gdG9PYmplY3QobGlzdCwgdmFsdWUpIHtcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBlYWNoKGxpc3QsIGZ1bmN0aW9uIChpdGVtLCBpbmRleCkge1xuICAgICAgICAgICAgb2JqW2l0ZW1dID0gdmFsdWU7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjb3B5T2JqKGZyb20sIHRvKSB7XG4gICAgICAgIHZhciBkZXN0ID0gdG8gfHwge307XG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4gZnJvbSlcbiAgICAgICAgICAgIGRlc3RbbmFtZV0gPSBmcm9tW25hbWVdO1xuICAgICAgICByZXR1cm4gZGVzdDtcbiAgICB9XG4gICAgZnVuY3Rpb24gbWVyZ2UobGlzdCwgdGFyZ2V0KSB7XG4gICAgICAgIHZhciBvID0gdGFyZ2V0O1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICBvID0gY29weU9iaihsaXN0W2ldLCBvKTtcbiAgICAgICAgcmV0dXJuIG87XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldEZpbmRGdW5jKGZpbmRGdW5jKSB7XG4gICAgICAgIHJldHVybiBpc0Z1bmN0aW9uKGZpbmRGdW5jKSA/IGZpbmRGdW5jIDogZnVuY3Rpb24gKG9iaiwgaW5kZXgpIHtcbiAgICAgICAgICAgIGlmIChmaW5kRnVuYyA9PT0gb2JqKVxuICAgICAgICAgICAgICAgIHJldHVybiBpbmRleDtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZ2V0RmluZEluZGV4KGxpc3QsIGluZGV4LCBkZWZhdWx0SW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIGluZGV4ID09IF9udWxsID8gZGVmYXVsdEluZGV4IDogaW5kZXggPCAwID8gTWF0aC5tYXgobGlzdC5sZW5ndGggKyBpbmRleCwgMCkgOiBNYXRoLm1pbihsaXN0Lmxlbmd0aCwgaW5kZXgpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBmaW5kKGxpc3QsIGZpbmRGdW5jLCBzdGFydEluZGV4LCBlbmRJbmRleCkge1xuICAgICAgICB2YXIgZiA9IGdldEZpbmRGdW5jKGZpbmRGdW5jKTtcbiAgICAgICAgdmFyIGUgPSBnZXRGaW5kSW5kZXgobGlzdCwgZW5kSW5kZXgsIGxpc3QubGVuZ3RoKTtcbiAgICAgICAgdmFyIHI7XG4gICAgICAgIGZvciAodmFyIGkgPSBnZXRGaW5kSW5kZXgobGlzdCwgc3RhcnRJbmRleCwgMCk7IGkgPCBlOyBpKyspXG4gICAgICAgICAgICBpZiAoKHIgPSBmLmNhbGwobGlzdCwgbGlzdFtpXSwgaSkpICE9IF9udWxsKVxuICAgICAgICAgICAgICAgIHJldHVybiByO1xuICAgIH1cbiAgICBmdW5jdGlvbiBmaW5kTGFzdChsaXN0LCBmaW5kRnVuYywgc3RhcnRJbmRleCwgZW5kSW5kZXgpIHtcbiAgICAgICAgdmFyIGYgPSBnZXRGaW5kRnVuYyhmaW5kRnVuYyk7XG4gICAgICAgIHZhciBlID0gZ2V0RmluZEluZGV4KGxpc3QsIGVuZEluZGV4LCAtMSk7XG4gICAgICAgIHZhciByO1xuICAgICAgICBmb3IgKHZhciBpID0gZ2V0RmluZEluZGV4KGxpc3QsIHN0YXJ0SW5kZXgsIGxpc3QubGVuZ3RoIC0gMSk7IGkgPiBlOyBpLS0pXG4gICAgICAgICAgICBpZiAoKHIgPSBmLmNhbGwobGlzdCwgbGlzdFtpXSwgaSkpICE9IF9udWxsKVxuICAgICAgICAgICAgICAgIHJldHVybiByO1xuICAgIH1cbiAgICBmdW5jdGlvbiBzdWIobGlzdCwgc3RhcnRJbmRleCwgZW5kSW5kZXgpIHtcbiAgICAgICAgdmFyIHIgPSBbXTtcbiAgICAgICAgaWYgKGxpc3QpIHtcbiAgICAgICAgICAgIHZhciBlID0gZ2V0RmluZEluZGV4KGxpc3QsIGVuZEluZGV4LCBsaXN0Lmxlbmd0aCk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gZ2V0RmluZEluZGV4KGxpc3QsIHN0YXJ0SW5kZXgsIDApOyBpIDwgZTsgaSsrKVxuICAgICAgICAgICAgICAgIHIucHVzaChsaXN0W2ldKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcjtcbiAgICB9XG4gICAgZnVuY3Rpb24gYXJyYXkobGlzdCkge1xuICAgICAgICByZXR1cm4gbWFwKGxpc3QsIG5vbk9wKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gdW5pdGUobGlzdCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBNKGNhbGxMaXN0KGxpc3QsIGFyZ3VtZW50cykpO1xuICAgICAgICB9O1xuICAgIH1cbiAgICBmdW5jdGlvbiB1bmlxKGxpc3QpIHtcbiAgICAgICAgdmFyIGZvdW5kID0ge307XG4gICAgICAgIHJldHVybiBmaWx0ZXIobGlzdCwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgICAgIGlmIChmb3VuZFtpdGVtXSlcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZvdW5kW2l0ZW1dID0gMTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGludGVyc2VjdGlvbihsaXN0LCBvdGhlckxpc3QpIHtcbiAgICAgICAgdmFyIGtleXMgPSB0b09iamVjdChvdGhlckxpc3QsIDEpO1xuICAgICAgICByZXR1cm4gZmlsdGVyKGxpc3QsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICB2YXIgciA9IGtleXNbaXRlbV07XG4gICAgICAgICAgICBrZXlzW2l0ZW1dID0gMDtcbiAgICAgICAgICAgIHJldHVybiByO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZnVuY3Rpb24gY29udGFpbnMobGlzdCwgdmFsdWUpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAgaWYgKGxpc3RbaV0gPT0gdmFsdWUpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZXF1YWxzKHgsIHkpIHtcbiAgICAgICAgdmFyIGEgPSBpc0Z1bmN0aW9uKHgpID8geCgpIDogeDtcbiAgICAgICAgdmFyIGIgPSBpc0Z1bmN0aW9uKHkpID8geSgpIDogeTtcbiAgICAgICAgdmFyIGFLZXlzO1xuICAgICAgICBpZiAoYSA9PSBiKVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIGVsc2UgaWYgKGEgPT0gX251bGwgfHwgYiA9PSBfbnVsbClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgZWxzZSBpZiAoaXNWYWx1ZShhKSB8fCBpc1ZhbHVlKGIpKVxuICAgICAgICAgICAgcmV0dXJuIGlzRGF0ZShhKSAmJiBpc0RhdGUoYikgJiYgK2EgPT0gK2I7XG4gICAgICAgIGVsc2UgaWYgKGlzTGlzdChhKSkge1xuICAgICAgICAgICAgcmV0dXJuIGEubGVuZ3RoID09IGIubGVuZ3RoICYmICFmaW5kKGEsIGZ1bmN0aW9uICh2YWwsIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFlcXVhbHModmFsLCBiW2luZGV4XSkpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gIWlzTGlzdChiKSAmJiAoYUtleXMgPSBrZXlzKGEpKS5sZW5ndGggPT0ga2V5Q291bnQoYikgJiYgIWZpbmQoYUtleXMsIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVxdWFscyhhW2tleV0sIGJba2V5XSkpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gY2FsbChmLCBmVGhpc09yQXJncywgYXJncykge1xuICAgICAgICBpZiAoaXNGdW5jdGlvbihmKSlcbiAgICAgICAgICAgIHJldHVybiBmLmFwcGx5KGFyZ3MgJiYgZlRoaXNPckFyZ3MsIG1hcChhcmdzIHx8IGZUaGlzT3JBcmdzLCBub25PcCkpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjYWxsTGlzdChsaXN0LCBmVGhpc09yQXJncywgYXJncykge1xuICAgICAgICByZXR1cm4gbWFwKGxpc3QsIGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsbChmLCBmVGhpc09yQXJncywgYXJncyk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBmdW5jdGlvbiBiaW5kKGYsIGZUaGlzLCBiZWZvcmVBcmdzLCBhZnRlckFyZ3MpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsKGYsIGZUaGlzLCBjb2xsZWN0KFtcbiAgICAgICAgICAgICAgICBiZWZvcmVBcmdzLFxuICAgICAgICAgICAgICAgIGFyZ3VtZW50cyxcbiAgICAgICAgICAgICAgICBhZnRlckFyZ3NcbiAgICAgICAgICAgIF0sIG5vbk9wKSk7XG4gICAgICAgIH07XG4gICAgfVxuICAgIGZ1bmN0aW9uIHBhcnRpYWwoZiwgYmVmb3JlQXJncywgYWZ0ZXJBcmdzKSB7XG4gICAgICAgIHJldHVybiBiaW5kKGYsIHRoaXMsIGJlZm9yZUFyZ3MsIGFmdGVyQXJncyk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHBhZChkaWdpdHMsIG51bWJlcikge1xuICAgICAgICB2YXIgc2lnbmVkID0gbnVtYmVyIDwgMCA/ICctJyA6ICcnO1xuICAgICAgICB2YXIgcHJlRGVjaW1hbCA9IChzaWduZWQgPyAtbnVtYmVyIDogbnVtYmVyKS50b0ZpeGVkKDApO1xuICAgICAgICB3aGlsZSAocHJlRGVjaW1hbC5sZW5ndGggPCBkaWdpdHMpXG4gICAgICAgICAgICBwcmVEZWNpbWFsID0gJzAnICsgcHJlRGVjaW1hbDtcbiAgICAgICAgcmV0dXJuIHNpZ25lZCArIHByZURlY2ltYWw7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHByb2Nlc3NOdW1DaGFyVGVtcGxhdGUodHBsLCBpbnB1dCwgZndkKSB7XG4gICAgICAgIHZhciBpbkhhc2g7XG4gICAgICAgIHZhciBpbnB1dFBvcyA9IDA7XG4gICAgICAgIHZhciBySW5wdXQgPSBmd2QgPyBpbnB1dCA6IHJldmVyc2UoaW5wdXQpO1xuICAgICAgICB2YXIgcyA9IChmd2QgPyB0cGwgOiByZXZlcnNlKHRwbCkpLnJlcGxhY2UoLy4vZywgZnVuY3Rpb24gKHRwbENoYXIpIHtcbiAgICAgICAgICAgIGlmICh0cGxDaGFyID09ICcwJykge1xuICAgICAgICAgICAgICAgIGluSGFzaCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHJldHVybiBySW5wdXQuY2hhckF0KGlucHV0UG9zKyspIHx8ICcwJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHBsQ2hhciA9PSAnIycpIHtcbiAgICAgICAgICAgICAgICBpbkhhc2ggPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBySW5wdXQuY2hhckF0KGlucHV0UG9zKyspIHx8ICcnO1xuICAgICAgICAgICAgfSBlbHNlXG4gICAgICAgICAgICAgICAgcmV0dXJuIGluSGFzaCAmJiAhcklucHV0LmNoYXJBdChpbnB1dFBvcykgPyAnJyA6IHRwbENoYXI7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZndkID8gcyA6IGlucHV0LnN1YnN0cigwLCBpbnB1dC5sZW5ndGggLSBpbnB1dFBvcykgKyByZXZlcnNlKHMpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRUaW1lem9uZShtYXRjaCwgaWR4LCByZWZEYXRlKSB7XG4gICAgICAgIGlmIChpZHggPT0gX251bGwgfHwgIW1hdGNoKVxuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIHJldHVybiBwYXJzZUZsb2F0KG1hdGNoW2lkeF0gKyBtYXRjaFtpZHggKyAxXSkgKiA2MCArIHBhcnNlRmxvYXQobWF0Y2hbaWR4XSArIG1hdGNoW2lkeCArIDJdKSArIHJlZkRhdGUuZ2V0VGltZXpvbmVPZmZzZXQoKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZm9ybWF0VmFsdWUoZm10LCB2YWx1ZSkge1xuICAgICAgICB2YXIgZm9ybWF0ID0gcmVwbGFjZShmbXQsIC9eXFw/Lyk7XG4gICAgICAgIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgICAgICAgICB2YXIgdGltZXpvbmUsIG1hdGNoO1xuICAgICAgICAgICAgaWYgKG1hdGNoID0gL15cXFsoKFsrLV0pKFxcZFxcZCkoXFxkXFxkKSlcXF1cXHMqKC4qKS8uZXhlYyhmb3JtYXQpKSB7XG4gICAgICAgICAgICAgICAgdGltZXpvbmUgPSBtYXRjaFsxXTtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGRhdGVBZGQodmFsdWUsICdtaW51dGVzJywgZ2V0VGltZXpvbmUobWF0Y2gsIDIsIHZhbHVlKSk7XG4gICAgICAgICAgICAgICAgZm9ybWF0ID0gbWF0Y2hbNV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVwbGFjZShmb3JtYXQsIC8oXFx3KShcXDEqKSg/OlxcWyhbXlxcXV0rKVxcXSk/L2csIGZ1bmN0aW9uIChzLCBwbGFjZWhvbGRlckNoYXIsIHBsYWNlaG9sZGVyRGlnaXRzLCBwYXJhbXMpIHtcbiAgICAgICAgICAgICAgICB2YXIgdmFsID0gRk9STUFUX0RBVEVfTUFQW3BsYWNlaG9sZGVyQ2hhcl07XG4gICAgICAgICAgICAgICAgaWYgKHZhbCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZCA9IHZhbHVlWydnZXQnICsgdmFsWzBdXSgpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgb3B0aW9uQXJyYXkgPSBwYXJhbXMgJiYgcGFyYW1zLnNwbGl0KCcsJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0xpc3QodmFsWzFdKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGQgPSAob3B0aW9uQXJyYXkgfHwgdmFsWzFdKVtkXTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgZCA9IHZhbFsxXShkLCBvcHRpb25BcnJheSwgdGltZXpvbmUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZCAhPSBfbnVsbCAmJiAhaXNTdHJpbmcoZCkpXG4gICAgICAgICAgICAgICAgICAgICAgICBkID0gcGFkKHBsYWNlaG9sZGVyRGlnaXRzLmxlbmd0aCArIDEsIGQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZDtcbiAgICAgICAgICAgICAgICB9IGVsc2VcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHM7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlXG4gICAgICAgICAgICByZXR1cm4gZmluZChmb3JtYXQuc3BsaXQoL1xccypcXHxcXHMqLyksIGZ1bmN0aW9uIChmbXRQYXJ0KSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hdGNoLCBudW1GbXRPclJlc3VsdDtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2ggPSAvXihbPD5dPykoPT8pKFteOl0qPylcXHMqOlxccyooLiopJC8uZXhlYyhmbXRQYXJ0KSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY21wVmFsMSA9IHZhbHVlLCBjbXBWYWwyID0gK21hdGNoWzNdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNOYU4oY21wVmFsMikgfHwgIWlzTnVtYmVyKGNtcFZhbDEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbXBWYWwxID0gY21wVmFsMSA9PSBfbnVsbCA/ICdudWxsJyA6IHRvU3RyaW5nKGNtcFZhbDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY21wVmFsMiA9IG1hdGNoWzNdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaFsxXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFtYXRjaFsyXSAmJiBjbXBWYWwxID09IGNtcFZhbDIgfHwgbWF0Y2hbMV0gPT0gJzwnICYmIGNtcFZhbDEgPiBjbXBWYWwyIHx8IG1hdGNoWzFdID09ICc+JyAmJiBjbXBWYWwxIDwgY21wVmFsMilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gX251bGw7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY21wVmFsMSAhPSBjbXBWYWwyKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF9udWxsO1xuICAgICAgICAgICAgICAgICAgICBudW1GbXRPclJlc3VsdCA9IG1hdGNoWzRdO1xuICAgICAgICAgICAgICAgIH0gZWxzZVxuICAgICAgICAgICAgICAgICAgICBudW1GbXRPclJlc3VsdCA9IGZtdFBhcnQ7XG4gICAgICAgICAgICAgICAgaWYgKGlzTnVtYmVyKHZhbHVlKSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bUZtdE9yUmVzdWx0LnJlcGxhY2UoL1swI10oLipbMCNdKT8vLCBmdW5jdGlvbiAobnVtRm10KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZGVjaW1hbEZtdCA9IC9eKFteLl0rKShcXC4pKFteLl0rKSQvLmV4ZWMobnVtRm10KSB8fCAvXihbXixdKykoLCkoW14sXSspJC8uZXhlYyhudW1GbXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNpZ25lZCA9IHZhbHVlIDwgMCA/ICctJyA6ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG51bURhdGEgPSAvKFxcZCspKFxcLihcXGQrKSk/Ly5leGVjKChzaWduZWQgPyAtdmFsdWUgOiB2YWx1ZSkudG9GaXhlZChkZWNpbWFsRm10ID8gZGVjaW1hbEZtdFszXS5sZW5ndGggOiAwKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHJlRGVjaW1hbEZtdCA9IGRlY2ltYWxGbXQgPyBkZWNpbWFsRm10WzFdIDogbnVtRm10O1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBvc3REZWNpbWFsID0gZGVjaW1hbEZtdCA/IHByb2Nlc3NOdW1DaGFyVGVtcGxhdGUoZGVjaW1hbEZtdFszXSwgcmVwbGFjZShudW1EYXRhWzNdLCAvMCskLyksIHRydWUpIDogJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKHNpZ25lZCA/ICctJyA6ICcnKSArIChwcmVEZWNpbWFsRm10ID09ICcjJyA/IG51bURhdGFbMV0gOiBwcm9jZXNzTnVtQ2hhclRlbXBsYXRlKHByZURlY2ltYWxGbXQsIG51bURhdGFbMV0pKSArIChwb3N0RGVjaW1hbC5sZW5ndGggPyBkZWNpbWFsRm10WzJdIDogJycpICsgcG9zdERlY2ltYWw7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bUZtdE9yUmVzdWx0O1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHBhcnNlRGF0ZShmbXQsIGRhdGUpIHtcbiAgICAgICAgdmFyIGluZGV4TWFwID0ge307XG4gICAgICAgIHZhciByZUluZGV4ID0gMTtcbiAgICAgICAgdmFyIHRpbWV6b25lT2Zmc2V0TWF0Y2g7XG4gICAgICAgIHZhciB0aW1lem9uZUluZGV4O1xuICAgICAgICB2YXIgbWF0Y2g7XG4gICAgICAgIHZhciBmb3JtYXQgPSByZXBsYWNlKGZtdCwgL15cXD8vKTtcbiAgICAgICAgaWYgKGZvcm1hdCAhPSBmbXQgJiYgIXRyaW0oZGF0ZSkpXG4gICAgICAgICAgICByZXR1cm4gX251bGw7XG4gICAgICAgIGlmIChtYXRjaCA9IC9eXFxbKFsrLV0pKFxcZFxcZCkoXFxkXFxkKVxcXVxccyooLiopLy5leGVjKGZvcm1hdCkpIHtcbiAgICAgICAgICAgIHRpbWV6b25lT2Zmc2V0TWF0Y2ggPSBtYXRjaDtcbiAgICAgICAgICAgIGZvcm1hdCA9IG1hdGNoWzRdO1xuICAgICAgICB9XG4gICAgICAgIHZhciBwYXJzZXIgPSBuZXcgUmVnRXhwKGZvcm1hdC5yZXBsYWNlKC8oLikoXFwxKikoPzpcXFsoW15cXF1dKilcXF0pPy9nLCBmdW5jdGlvbiAod2hvbGVNYXRjaCwgcGxhY2Vob2xkZXJDaGFyLCBwbGFjZWhvbGRlckRpZ2l0cywgcGFyYW0pIHtcbiAgICAgICAgICAgIGlmICgvW2RtaGt5aHNdL2kudGVzdChwbGFjZWhvbGRlckNoYXIpKSB7XG4gICAgICAgICAgICAgICAgaW5kZXhNYXBbcmVJbmRleCsrXSA9IHBsYWNlaG9sZGVyQ2hhcjtcbiAgICAgICAgICAgICAgICB2YXIgcGxlbiA9IHBsYWNlaG9sZGVyRGlnaXRzLmxlbmd0aCArIDE7XG4gICAgICAgICAgICAgICAgcmV0dXJuICcoXFxcXGQnICsgKHBsZW4gPCAyID8gJysnIDogJ3sxLCcgKyBwbGVuICsgJ30nKSArICcpJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGxhY2Vob2xkZXJDaGFyID09ICd6Jykge1xuICAgICAgICAgICAgICAgIHRpbWV6b25lSW5kZXggPSByZUluZGV4O1xuICAgICAgICAgICAgICAgIHJlSW5kZXggKz0gMztcbiAgICAgICAgICAgICAgICByZXR1cm4gJyhbKy1dKShcXFxcZFxcXFxkKShcXFxcZFxcXFxkKSc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKC9bTm5hXS8udGVzdChwbGFjZWhvbGRlckNoYXIpKSB7XG4gICAgICAgICAgICAgICAgaW5kZXhNYXBbcmVJbmRleCsrXSA9IFtcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXJDaGFyLFxuICAgICAgICAgICAgICAgICAgICBwYXJhbSAmJiBwYXJhbS5zcGxpdCgnLCcpXG4gICAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJyhbYS16QS1aXFxcXHUwMDgwLVxcXFx1MWZmZl0rKSc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKC93L2kudGVzdChwbGFjZWhvbGRlckNoYXIpKVxuICAgICAgICAgICAgICAgIHJldHVybiAnW2EtekEtWlxcXFx1MDA4MC1cXFxcdTFmZmZdKyc7XG4gICAgICAgICAgICBlbHNlIGlmICgvXFxzLy50ZXN0KHBsYWNlaG9sZGVyQ2hhcikpXG4gICAgICAgICAgICAgICAgcmV0dXJuICdcXFxccysnO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHJldHVybiBlc2NhcGVSZWdFeHAod2hvbGVNYXRjaCk7XG4gICAgICAgIH0pKTtcbiAgICAgICAgaWYgKCEobWF0Y2ggPSBwYXJzZXIuZXhlYyhkYXRlKSkpXG4gICAgICAgICAgICByZXR1cm4gdW5kZWY7XG4gICAgICAgIHZhciBjdG9yQXJncyA9IFtcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAwLFxuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAwLFxuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIDBcbiAgICAgICAgXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCByZUluZGV4OyBpKyspIHtcbiAgICAgICAgICAgIHZhciBtYXRjaFZhbCA9IG1hdGNoW2ldO1xuICAgICAgICAgICAgdmFyIGluZGV4RW50cnkgPSBpbmRleE1hcFtpXTtcbiAgICAgICAgICAgIGlmIChpc0xpc3QoaW5kZXhFbnRyeSkpIHtcbiAgICAgICAgICAgICAgICB2YXIgcGxhY2Vob2xkZXJDaGFyID0gaW5kZXhFbnRyeVswXTtcbiAgICAgICAgICAgICAgICB2YXIgbWFwRW50cnkgPSBQQVJTRV9EQVRFX01BUFtwbGFjZWhvbGRlckNoYXJdO1xuICAgICAgICAgICAgICAgIHZhciBjdG9ySW5kZXggPSBtYXBFbnRyeVswXTtcbiAgICAgICAgICAgICAgICB2YXIgdmFsTGlzdCA9IGluZGV4RW50cnlbMV0gfHwgbWFwRW50cnlbMV07XG4gICAgICAgICAgICAgICAgdmFyIGxpc3RWYWx1ZSA9IGZpbmQodmFsTGlzdCwgZnVuY3Rpb24gKHYsIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGFydHNXaXRoKG1hdGNoVmFsLnRvTG93ZXJDYXNlKCksIHYudG9Mb3dlckNhc2UoKSkpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaW5kZXg7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKGxpc3RWYWx1ZSA9PSBfbnVsbClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmO1xuICAgICAgICAgICAgICAgIGlmIChwbGFjZWhvbGRlckNoYXIgPT0gJ2EnKVxuICAgICAgICAgICAgICAgICAgICBjdG9yQXJnc1tjdG9ySW5kZXhdICs9IGxpc3RWYWx1ZSAqIDEyO1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgY3RvckFyZ3NbY3RvckluZGV4XSA9IGxpc3RWYWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaW5kZXhFbnRyeSkge1xuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IHBhcnNlRmxvYXQobWF0Y2hWYWwpO1xuICAgICAgICAgICAgICAgIHZhciBtYXBFbnRyeSA9IFBBUlNFX0RBVEVfTUFQW2luZGV4RW50cnldO1xuICAgICAgICAgICAgICAgIGlmIChpc0xpc3QobWFwRW50cnkpKVxuICAgICAgICAgICAgICAgICAgICBjdG9yQXJnc1ttYXBFbnRyeVswXV0gKz0gdmFsdWUgLSBtYXBFbnRyeVsxXTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIGN0b3JBcmdzW21hcEVudHJ5XSArPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2YXIgZCA9IG5ldyBEYXRlKGN0b3JBcmdzWzBdLCBjdG9yQXJnc1sxXSwgY3RvckFyZ3NbMl0sIGN0b3JBcmdzWzNdLCBjdG9yQXJnc1s0XSwgY3RvckFyZ3NbNV0sIGN0b3JBcmdzWzZdKTtcbiAgICAgICAgcmV0dXJuIGRhdGVBZGQoZCwgJ21pbnV0ZXMnLCAtZ2V0VGltZXpvbmUodGltZXpvbmVPZmZzZXRNYXRjaCwgMSwgZCkgLSBnZXRUaW1lem9uZShtYXRjaCwgdGltZXpvbmVJbmRleCwgZCkpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBwYXJzZU51bWJlcihmbXQsIHZhbHVlKSB7XG4gICAgICAgIHZhciBmb3JtYXQgPSByZXBsYWNlKGZtdCwgL15cXD8vKTtcbiAgICAgICAgaWYgKGZvcm1hdCAhPSBmbXQgJiYgIXRyaW0odmFsdWUpKVxuICAgICAgICAgICAgcmV0dXJuIF9udWxsO1xuICAgICAgICB2YXIgZGVjU2VwID0gLyhefFteMCMuLF0pKCx8WzAjLl0qLFswI10rfFswI10rXFwuWzAjXStcXC5bMCMuLF0qKSgkfFteMCMuLF0pLy50ZXN0KGZvcm1hdCkgPyAnLCcgOiAnLic7XG4gICAgICAgIHZhciByID0gcGFyc2VGbG9hdChyZXBsYWNlKHJlcGxhY2UocmVwbGFjZSh2YWx1ZSwgZGVjU2VwID09ICcsJyA/IC9cXC4vZyA6IC8sL2cpLCBkZWNTZXAsICcuJyksIC9eW15cXGQtXSooLT9cXGQpLywgJyQxJykpO1xuICAgICAgICByZXR1cm4gaXNOYU4ocikgPyB1bmRlZiA6IHI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG5vdygpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEYXRlKCk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGRhdGVDbG9uZShkYXRlKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGF0ZSgrZGF0ZSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNhcFdvcmQodykge1xuICAgICAgICByZXR1cm4gdy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHcuc3Vic3RyKDEpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBkYXRlQWRkSW5saW5lKGQsIGNQcm9wLCB2YWx1ZSkge1xuICAgICAgICBkWydzZXQnICsgY1Byb3BdKGRbJ2dldCcgKyBjUHJvcF0oKSArIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIGQ7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGRhdGVBZGQoZGF0ZSwgcHJvcGVydHksIHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PSBfbnVsbClcbiAgICAgICAgICAgIHJldHVybiBkYXRlQWRkKG5vdygpLCBkYXRlLCBwcm9wZXJ0eSk7XG4gICAgICAgIHJldHVybiBkYXRlQWRkSW5saW5lKGRhdGVDbG9uZShkYXRlKSwgY2FwV29yZChwcm9wZXJ0eSksIHZhbHVlKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZGF0ZU1pZG5pZ2h0KGRhdGUpIHtcbiAgICAgICAgdmFyIG9kID0gZGF0ZSB8fCBub3coKTtcbiAgICAgICAgcmV0dXJuIG5ldyBEYXRlKG9kLmdldEZ1bGxZZWFyKCksIG9kLmdldE1vbnRoKCksIG9kLmdldERhdGUoKSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGRhdGVEaWZmKHByb3BlcnR5LCBkYXRlMSwgZGF0ZTIpIHtcbiAgICAgICAgdmFyIGQxdCA9ICtkYXRlMTtcbiAgICAgICAgdmFyIGQydCA9ICtkYXRlMjtcbiAgICAgICAgdmFyIGR0ID0gZDJ0IC0gZDF0O1xuICAgICAgICBpZiAoZHQgPCAwKVxuICAgICAgICAgICAgcmV0dXJuIC1kYXRlRGlmZihwcm9wZXJ0eSwgZGF0ZTIsIGRhdGUxKTtcbiAgICAgICAgdmFyIHByb3BWYWx1ZXMgPSB7XG4gICAgICAgICAgICAnbWlsbGlzZWNvbmRzJzogMSxcbiAgICAgICAgICAgICdzZWNvbmRzJzogMTAwMCxcbiAgICAgICAgICAgICdtaW51dGVzJzogNjAwMDAsXG4gICAgICAgICAgICAnaG91cnMnOiAzNjAwMDAwXG4gICAgICAgIH07XG4gICAgICAgIHZhciBmdCA9IHByb3BWYWx1ZXNbcHJvcGVydHldO1xuICAgICAgICBpZiAoZnQpXG4gICAgICAgICAgICByZXR1cm4gZHQgLyBmdDtcbiAgICAgICAgdmFyIGNQcm9wID0gY2FwV29yZChwcm9wZXJ0eSk7XG4gICAgICAgIHZhciBjYWxBcHByb3hWYWx1ZXMgPSB7XG4gICAgICAgICAgICAnZnVsbFllYXInOiA4NjQwMDAwMCAqIDM2NSxcbiAgICAgICAgICAgICdtb250aCc6IDg2NDAwMDAwICogMzY1IC8gMTIsXG4gICAgICAgICAgICAnZGF0ZSc6IDg2NDAwMDAwXG4gICAgICAgIH07XG4gICAgICAgIHZhciBtaW5pbXVtUmVzdWx0ID0gTWF0aC5mbG9vcihkdCAvIGNhbEFwcHJveFZhbHVlc1twcm9wZXJ0eV0gLSAyKTtcbiAgICAgICAgdmFyIGQgPSBkYXRlQWRkSW5saW5lKG5ldyBEYXRlKGQxdCksIGNQcm9wLCBtaW5pbXVtUmVzdWx0KTtcbiAgICAgICAgZm9yICh2YXIgaSA9IG1pbmltdW1SZXN1bHQ7IGkgPCBtaW5pbXVtUmVzdWx0ICogMS4yICsgNDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoK2RhdGVBZGRJbmxpbmUoZCwgY1Byb3AsIDEpID4gZDJ0KVxuICAgICAgICAgICAgICAgIHJldHVybiBpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIHVjb2RlKGEpIHtcbiAgICAgICAgcmV0dXJuICdcXFxcdScgKyAoJzAwMDAnICsgYS5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KSkuc2xpY2UoLTQpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBlc2NhcGVKYXZhU2NyaXB0U3RyaW5nKHMpIHtcbiAgICAgICAgcmV0dXJuIHJlcGxhY2UocywgL1tcXHgwMC1cXHgxZidcIlxcdTIwMjhcXHUyMDI5XS9nLCB1Y29kZSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHNwbGl0KHN0ciwgcmVnZXhwKSB7XG4gICAgICAgIHJldHVybiBzdHIuc3BsaXQocmVnZXhwKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gdGVtcGxhdGUodGVtcGxhdGUsIGVzY2FwZUZ1bmN0aW9uKSB7XG4gICAgICAgIGlmICh0ZW1wbGF0ZUNhY2hlW3RlbXBsYXRlXSlcbiAgICAgICAgICAgIHJldHVybiB0ZW1wbGF0ZUNhY2hlW3RlbXBsYXRlXTtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgZnVuY0JvZHkgPSAnd2l0aChfLmlzT2JqZWN0KG9iaik/b2JqOnt9KXsnICsgbWFwKHNwbGl0KHRlbXBsYXRlLCAve3t8fX19Py9nKSwgZnVuY3Rpb24gKGNodW5rLCBpbmRleCkge1xuICAgICAgICAgICAgICAgIHZhciBtYXRjaCwgYzEgPSB0cmltKGNodW5rKSwgYzIgPSByZXBsYWNlKGMxLCAvXnsvKSwgZXNjYXBlU25pcHBldCA9IGMxID09IGMyID8gJ2VzYygnIDogJyc7XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ICUgMikge1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2ggPSAvXmVhY2hcXGIoXFxzKyhbXFx3X10rKFxccyosXFxzKltcXHdfXSspPylcXHMqOik/KC4qKS8uZXhlYyhjMikpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2VhY2goJyArICh0cmltKG1hdGNoWzRdKSA/IG1hdGNoWzRdIDogJ3RoaXMnKSArICcsIGZ1bmN0aW9uKCcgKyBtYXRjaFsyXSArICcpeyc7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKG1hdGNoID0gL15pZlxcYiguKikvLmV4ZWMoYzIpKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdpZignICsgbWF0Y2hbMV0gKyAnKXsnO1xuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChtYXRjaCA9IC9eZWxzZVxcYlxccyooaWZcXGIoLiopKT8vLmV4ZWMoYzIpKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICd9ZWxzZSAnICsgKG1hdGNoWzFdID8gJ2lmKCcgKyBtYXRjaFsyXSArICcpJyA6ICcnKSArICd7JztcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAobWF0Y2ggPSAvXlxcLyhpZik/Ly5leGVjKGMyKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtYXRjaFsxXSA/ICd9XFxuJyA6ICd9KTtcXG4nO1xuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChtYXRjaCA9IC9eKHZhclxccy4qKS8uZXhlYyhjMikpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWF0Y2hbMV0gKyAnOyc7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKG1hdGNoID0gL14jKC4qKS8uZXhlYyhjMikpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWF0Y2hbMV07XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKG1hdGNoID0gLyguKik6OlxccyooLiopLy5leGVjKGMyKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAncHJpbnQoJyArIGVzY2FwZVNuaXBwZXQgKyAnXy5mb3JtYXRWYWx1ZShcIicgKyBlc2NhcGVKYXZhU2NyaXB0U3RyaW5nKG1hdGNoWzJdKSArICdcIiwnICsgKHRyaW0obWF0Y2hbMV0pID8gbWF0Y2hbMV0gOiAndGhpcycpICsgKGVzY2FwZVNuaXBwZXQgJiYgJyknKSArICcpKTtcXG4nO1xuICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3ByaW50KCcgKyBlc2NhcGVTbmlwcGV0ICsgKHRyaW0oYzIpID8gYzIgOiAndGhpcycpICsgKGVzY2FwZVNuaXBwZXQgJiYgJyknKSArICcpO1xcbic7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjaHVuaykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3ByaW50KFwiJyArIGVzY2FwZUphdmFTY3JpcHRTdHJpbmcoY2h1bmspICsgJ1wiKTtcXG4nO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLmpvaW4oJycpICsgJ30nO1xuICAgICAgICAgICAgdmFyIGYgPSBuZXcgRnVuY3Rpb24oJ29iaicsICdlYWNoJywgJ2VzYycsICdwcmludCcsICdfJywgZnVuY0JvZHkpO1xuICAgICAgICAgICAgdmFyIHQgPSBmdW5jdGlvbiAob2JqLCB0aGlzQ29udGV4dCkge1xuICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgICAgICAgICBmLmNhbGwodGhpc0NvbnRleHQgfHwgb2JqLCBvYmosIGZ1bmN0aW9uIChvYmosIGZ1bmMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzTGlzdChvYmopKVxuICAgICAgICAgICAgICAgICAgICAgICAgZWFjaChvYmosIGZ1bmN0aW9uICh2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jLmNhbGwodmFsdWUsIHZhbHVlLCBpbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgZWFjaE9iaihvYmosIGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuYy5jYWxsKHZhbHVlLCBrZXksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0sIGVzY2FwZUZ1bmN0aW9uIHx8IG5vbk9wLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGwocmVzdWx0WydwdXNoJ10sIHJlc3VsdCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB9LCBfKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0LmpvaW4oJycpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICh0ZW1wbGF0ZXMucHVzaCh0KSA+IE1BWF9DQUNIRURfVEVNUExBVEVTKVxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0ZW1wbGF0ZUNhY2hlW3RlbXBsYXRlcy5zaGlmdCgpXTtcbiAgICAgICAgICAgIHJldHVybiB0ZW1wbGF0ZUNhY2hlW3RlbXBsYXRlXSA9IHQ7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gZXNjYXBlSHRtbChzKSB7XG4gICAgICAgIHJldHVybiByZXBsYWNlKHMsIC9bPD4nXCImXS9nLCBmdW5jdGlvbiAocykge1xuICAgICAgICAgICAgcmV0dXJuICcmIycgKyBzLmNoYXJDb2RlQXQoMCkgKyAnOyc7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBmdW5jdGlvbiBmb3JtYXRIdG1sKHRwbCwgb2JqKSB7XG4gICAgICAgIHJldHVybiB0ZW1wbGF0ZSh0cGwsIGVzY2FwZUh0bWwpKG9iaik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGxpc3RCaW5kQXJyYXkoZnVuYykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGFyZzEsIGFyZzIpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgTShmdW5jKHRoaXMsIGFyZzEsIGFyZzIpKTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbGlzdEJpbmQoZnVuYykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGFyZzEsIGFyZzIsIGFyZzMpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jKHRoaXMsIGFyZzEsIGFyZzIsIGFyZzMpO1xuICAgICAgICB9O1xuICAgIH1cbiAgICBmdW5jdGlvbiBmdW5jQXJyYXlCaW5kKGZ1bmMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChhcmcxLCBhcmcyLCBhcmczKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IE0oZnVuYyhhcmcxLCBhcmcyLCBhcmczKSk7XG4gICAgICAgIH07XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzRnVuY3Rpb24oZikge1xuICAgICAgICByZXR1cm4gdHlwZW9mIGYgPT0gJ2Z1bmN0aW9uJyAmJiAhZlsnaXRlbSddO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc0xpc3Qodikge1xuICAgICAgICByZXR1cm4gdiAmJiB2Lmxlbmd0aCAhPSBfbnVsbCAmJiAhaXNTdHJpbmcodikgJiYgIWlzTm9kZSh2KSAmJiAhaXNGdW5jdGlvbih2KSAmJiB2ICE9PSBfd2luZG93O1xuICAgIH1cbiAgICBmdW5jdGlvbiBwdXNoKG9iaiwgcHJvcCwgdmFsdWUpIHtcbiAgICAgICAgKG9ialtwcm9wXSA9IG9ialtwcm9wXSB8fCBbXSkucHVzaCh2YWx1ZSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlbW92ZUZyb21BcnJheShhcnJheSwgdmFsdWUpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGFycmF5ICYmIGkgPCBhcnJheS5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgIGlmIChhcnJheVtpXSA9PT0gdmFsdWUpXG4gICAgICAgICAgICAgICAgYXJyYXlbJ3NwbGljZSddKGktLSwgMSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGV4dHJhY3ROdW1iZXIodikge1xuICAgICAgICByZXR1cm4gcGFyc2VGbG9hdChyZXBsYWNlKHYsIC9eW15cXGQtXSsvKSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldE5vZGVJZChlbCkge1xuICAgICAgICByZXR1cm4gZWxbTUlOSUZJRURfTUFHSUNfTk9ERUlEXSA9IGVsW01JTklGSUVEX01BR0lDX05PREVJRF0gfHwgKytpZFNlcXVlbmNlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjb2xsZWN0VW5pcU5vZGVzKGxpc3QsIGZ1bmMpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgICB2YXIgbm9kZUlkcyA9IHt9O1xuICAgICAgICB2YXIgY3VycmVudE5vZGVJZDtcbiAgICAgICAgZmxleGlFYWNoKGxpc3QsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgZmxleGlFYWNoKGZ1bmModmFsdWUpLCBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgIGlmICghbm9kZUlkc1tjdXJyZW50Tm9kZUlkID0gZ2V0Tm9kZUlkKG5vZGUpXSkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChub2RlKTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZUlkc1tjdXJyZW50Tm9kZUlkXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICBmdW5jdGlvbiBnZXROYXR1cmFsSGVpZ2h0KGVsZW1lbnRMaXN0LCBmYWN0b3IpIHtcbiAgICAgICAgdmFyIHEgPSB7XG4gICAgICAgICAgICAnJHBvc2l0aW9uJzogJ2Fic29sdXRlJyxcbiAgICAgICAgICAgICckdmlzaWJpbGl0eSc6ICdoaWRkZW4nLFxuICAgICAgICAgICAgJyRkaXNwbGF5JzogJ2Jsb2NrJyxcbiAgICAgICAgICAgICckaGVpZ2h0JzogX251bGxcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIG9sZFN0eWxlcyA9IGVsZW1lbnRMaXN0WydnZXQnXShxKTtcbiAgICAgICAgdmFyIGggPSBlbGVtZW50TGlzdFsnc2V0J10ocSlbJ2dldCddKCdjbGllbnRIZWlnaHQnKTtcbiAgICAgICAgZWxlbWVudExpc3RbJ3NldCddKG9sZFN0eWxlcyk7XG4gICAgICAgIHJldHVybiBoICogZmFjdG9yICsgJ3B4JztcbiAgICB9XG4gICAgZnVuY3Rpb24gb24oc3ViU2VsZWN0b3IsIGV2ZW50U3BlYywgaGFuZGxlciwgYXJncywgYnViYmxlU2VsZWN0b3IpIHtcbiAgICAgICAgaWYgKGlzRnVuY3Rpb24oZXZlbnRTcGVjKSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzWydvbiddKF9udWxsLCBzdWJTZWxlY3RvciwgZXZlbnRTcGVjLCBoYW5kbGVyLCBhcmdzKTtcbiAgICAgICAgZWxzZSBpZiAoaXNTdHJpbmcoYXJncykpXG4gICAgICAgICAgICByZXR1cm4gdGhpc1snb24nXShzdWJTZWxlY3RvciwgZXZlbnRTcGVjLCBoYW5kbGVyLCBfbnVsbCwgYXJncyk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVybiB0aGlzWydlYWNoJ10oZnVuY3Rpb24gKGJhc2VFbGVtZW50LCBpbmRleCkge1xuICAgICAgICAgICAgICAgIGZsZXhpRWFjaChzdWJTZWxlY3RvciA/IGRvbGxhclJhdyhzdWJTZWxlY3RvciwgYmFzZUVsZW1lbnQpIDogYmFzZUVsZW1lbnQsIGZ1bmN0aW9uIChyZWdpc3RlcmVkT24pIHtcbiAgICAgICAgICAgICAgICAgICAgZmxleGlFYWNoKHRvU3RyaW5nKGV2ZW50U3BlYykuc3BsaXQoL1xccy8pLCBmdW5jdGlvbiAobmFtZVByZWZpeGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmFtZSA9IHJlcGxhY2UobmFtZVByZWZpeGVkLCAvWz98XS9nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwcmVmaXggPSByZXBsYWNlKG5hbWVQcmVmaXhlZCwgL1teP3xdL2cpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNhcHR1cmUgPSAobmFtZSA9PSAnYmx1cicgfHwgbmFtZSA9PSAnZm9jdXMnKSAmJiAhIWJ1YmJsZVNlbGVjdG9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRyaWdnZXJJZCA9IGlkU2VxdWVuY2UrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIHRyaWdnZXJIYW5kbGVyKGV2ZW50TmFtZSwgZXZlbnQsIHRhcmdldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtYXRjaCA9ICFidWJibGVTZWxlY3RvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZWwgPSBidWJibGVTZWxlY3RvciA/IHRhcmdldCA6IHJlZ2lzdGVyZWRPbjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYnViYmxlU2VsZWN0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNlbGVjdG9yRmlsdGVyID0gZ2V0RmlsdGVyRnVuYyhidWJibGVTZWxlY3RvciwgcmVnaXN0ZXJlZE9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGVsICYmIGVsICE9IHJlZ2lzdGVyZWRPbiAmJiAhKG1hdGNoID0gc2VsZWN0b3JGaWx0ZXIoZWwpKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsID0gZWxbJ3BhcmVudE5vZGUnXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICFtYXRjaCB8fCBuYW1lICE9IGV2ZW50TmFtZSB8fCAoaGFuZGxlci5hcHBseSgkKGVsKSwgYXJncyB8fCBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF0pICYmIHByZWZpeCA9PSAnPycgfHwgcHJlZml4ID09ICd8Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICA7XG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBldmVudEhhbmRsZXIoZXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRyaWdnZXJIYW5kbGVyKG5hbWUsIGV2ZW50LCBldmVudFsndGFyZ2V0J10pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50WydwcmV2ZW50RGVmYXVsdCddKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50WydzdG9wUHJvcGFnYXRpb24nXSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlZ2lzdGVyZWRPbi5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50SGFuZGxlciwgY2FwdHVyZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXJlZ2lzdGVyZWRPblsnTSddKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZ2lzdGVyZWRPblsnTSddID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICByZWdpc3RlcmVkT25bJ00nXVt0cmlnZ2VySWRdID0gdHJpZ2dlckhhbmRsZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVyWydNJ10gPSBjb2xsZWN0b3IoZmxleGlFYWNoLCBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlclsnTSddLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVnaXN0ZXJlZE9uLnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRIYW5kbGVyLCBjYXB0dXJlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHJlZ2lzdGVyZWRPblsnTSddW3RyaWdnZXJJZF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXSwgbm9uT3ApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cbiAgICBmdW5jdGlvbiBvZmYoaGFuZGxlcikge1xuICAgICAgICBjYWxsTGlzdChoYW5kbGVyWydNJ10pO1xuICAgICAgICBoYW5kbGVyWydNJ10gPSBfbnVsbDtcbiAgICB9XG4gICAgZnVuY3Rpb24gZGV0YWNoSGFuZGxlckxpc3QoZHVtbXksIGhhbmRsZXJMaXN0KSB7XG4gICAgICAgIGZsZXhpRWFjaChoYW5kbGVyTGlzdCwgZnVuY3Rpb24gKGgpIHtcbiAgICAgICAgICAgIGguZWxlbWVudC5kZXRhY2hFdmVudCgnb24nICsgaC5ldmVudFR5cGUsIGguaGFuZGxlckZ1bmMpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZnVuY3Rpb24gcmVhZHkoaGFuZGxlcikge1xuICAgICAgICBpZiAoRE9NUkVBRFlfSEFORExFUilcbiAgICAgICAgICAgIERPTVJFQURZX0hBTkRMRVIucHVzaChoYW5kbGVyKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgc2V0VGltZW91dChoYW5kbGVyLCAwKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gJCQoc2VsZWN0b3IsIGNvbnRleHQsIGNoaWxkcmVuT25seSkge1xuICAgICAgICByZXR1cm4gZG9sbGFyUmF3KHNlbGVjdG9yLCBjb250ZXh0LCBjaGlsZHJlbk9ubHkpWzBdO1xuICAgIH1cbiAgICBmdW5jdGlvbiBFRShlbGVtZW50TmFtZSwgYXR0cmlidXRlcywgY2hpbGRyZW4pIHtcbiAgICAgICAgdmFyIGUgPSAkKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoZWxlbWVudE5hbWUpKTtcbiAgICAgICAgcmV0dXJuIGlzTGlzdChhdHRyaWJ1dGVzKSB8fCBhdHRyaWJ1dGVzICE9IF9udWxsICYmICFpc09iamVjdChhdHRyaWJ1dGVzKSA/IGVbJ2FkZCddKGF0dHJpYnV0ZXMpIDogZVsnc2V0J10oYXR0cmlidXRlcylbJ2FkZCddKGNoaWxkcmVuKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gY2xvbmUobGlzdE9yTm9kZSkge1xuICAgICAgICByZXR1cm4gY29sbGVjdG9yKGZsZXhpRWFjaCwgbGlzdE9yTm9kZSwgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIHZhciBjO1xuICAgICAgICAgICAgaWYgKGlzTGlzdChlKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gY2xvbmUoZSk7XG4gICAgICAgICAgICBlbHNlIGlmIChpc05vZGUoZSkpIHtcbiAgICAgICAgICAgICAgICBjID0gZVsnY2xvbmVOb2RlJ10odHJ1ZSk7XG4gICAgICAgICAgICAgICAgY1sncmVtb3ZlQXR0cmlidXRlJ10gJiYgY1sncmVtb3ZlQXR0cmlidXRlJ10oJ2lkJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGM7XG4gICAgICAgICAgICB9IGVsc2VcbiAgICAgICAgICAgICAgICByZXR1cm4gZTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uICQoc2VsZWN0b3IsIGNvbnRleHQsIGNoaWxkT25seSkge1xuICAgICAgICByZXR1cm4gaXNGdW5jdGlvbihzZWxlY3RvcikgPyByZWFkeShzZWxlY3RvcikgOiBuZXcgTShkb2xsYXJSYXcoc2VsZWN0b3IsIGNvbnRleHQsIGNoaWxkT25seSkpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBkb2xsYXJSYXcoc2VsZWN0b3IsIGNvbnRleHQsIGNoaWxkT25seSkge1xuICAgICAgICBmdW5jdGlvbiBmbGF0dGVuKGEpIHtcbiAgICAgICAgICAgIHJldHVybiBpc0xpc3QoYSkgPyBjb2xsZWN0b3IoZmxleGlFYWNoLCBhLCBmbGF0dGVuKSA6IGE7XG4gICAgICAgIH1cbiAgICAgICAgZnVuY3Rpb24gZmlsdGVyRWxlbWVudHMobGlzdCkge1xuICAgICAgICAgICAgcmV0dXJuIGZpbHRlcihjb2xsZWN0b3IoZmxleGlFYWNoLCBsaXN0LCBmbGF0dGVuKSwgZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICB2YXIgYSA9IG5vZGU7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGEgPSBhWydwYXJlbnROb2RlJ10pXG4gICAgICAgICAgICAgICAgICAgIGlmIChhID09IGNvbnRleHRbMF0gfHwgY2hpbGRPbmx5KVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGEgPT0gY29udGV4dFswXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb250ZXh0KSB7XG4gICAgICAgICAgICBpZiAoKGNvbnRleHQgPSBkb2xsYXJSYXcoY29udGV4dCkpLmxlbmd0aCAhPSAxKVxuICAgICAgICAgICAgICAgIHJldHVybiBjb2xsZWN0VW5pcU5vZGVzKGNvbnRleHQsIGZ1bmN0aW9uIChjaSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZG9sbGFyUmF3KHNlbGVjdG9yLCBjaSwgY2hpbGRPbmx5KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGVsc2UgaWYgKGlzU3RyaW5nKHNlbGVjdG9yKSkge1xuICAgICAgICAgICAgICAgIGlmIChpc05vZGUoY29udGV4dFswXSkgIT0gMSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNoaWxkT25seSA/IGZpbHRlckVsZW1lbnRzKGNvbnRleHRbMF0ucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcikpIDogY29udGV4dFswXS5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICAgICAgICAgIH0gZWxzZVxuICAgICAgICAgICAgICAgIHJldHVybiBmaWx0ZXJFbGVtZW50cyhzZWxlY3Rvcik7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNTdHJpbmcoc2VsZWN0b3IpKVxuICAgICAgICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICByZXR1cm4gY29sbGVjdG9yKGZsZXhpRWFjaCwgc2VsZWN0b3IsIGZsYXR0ZW4pO1xuICAgIH1cbiAgICA7XG4gICAgZnVuY3Rpb24gZ2V0RmlsdGVyRnVuYyhzZWxlY3RvciwgY29udGV4dCkge1xuICAgICAgICBmdW5jdGlvbiB3b3JkUmVnRXhwVGVzdGVyKG5hbWUsIHByb3ApIHtcbiAgICAgICAgICAgIHZhciByZSA9IFJlZ0V4cCgnKF58XFxcXHMrKScgKyBuYW1lICsgJyg/PSR8XFxcXHMpJywgJ2knKTtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5hbWUgPyByZS50ZXN0KG9ialtwcm9wXSkgOiB0cnVlO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbm9kZVNldCA9IHt9O1xuICAgICAgICB2YXIgZG90UG9zID0gbm9kZVNldDtcbiAgICAgICAgaWYgKGlzRnVuY3Rpb24oc2VsZWN0b3IpKVxuICAgICAgICAgICAgcmV0dXJuIHNlbGVjdG9yO1xuICAgICAgICBlbHNlIGlmIChpc051bWJlcihzZWxlY3RvcikpXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHYsIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGluZGV4ID09IHNlbGVjdG9yO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgZWxzZSBpZiAoIXNlbGVjdG9yIHx8IHNlbGVjdG9yID09ICcqJyB8fCBpc1N0cmluZyhzZWxlY3RvcikgJiYgKGRvdFBvcyA9IC9eKFtcXHctXSopXFwuPyhbXFx3LV0qKSQvLmV4ZWMoc2VsZWN0b3IpKSkge1xuICAgICAgICAgICAgdmFyIG5vZGVOYW1lRmlsdGVyID0gd29yZFJlZ0V4cFRlc3Rlcihkb3RQb3NbMV0sICd0YWdOYW1lJyk7XG4gICAgICAgICAgICB2YXIgY2xhc3NOYW1lRmlsdGVyID0gd29yZFJlZ0V4cFRlc3Rlcihkb3RQb3NbMl0sICdjbGFzc05hbWUnKTtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIHJldHVybiBpc05vZGUodikgPT0gMSAmJiBub2RlTmFtZUZpbHRlcih2KSAmJiBjbGFzc05hbWVGaWx0ZXIodik7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKGNvbnRleHQpXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJChzZWxlY3RvciwgY29udGV4dClbJ2ZpbmQnXSh2KSAhPSBfbnVsbDtcbiAgICAgICAgICAgIH07XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgJChzZWxlY3RvcilbJ2VhY2gnXShmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgIG5vZGVTZXRbZ2V0Tm9kZUlkKG5vZGUpXSA9IHRydWU7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgIHJldHVybiBub2RlU2V0W2dldE5vZGVJZCh2KV07XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldEludmVyc2VGaWx0ZXJGdW5jKHNlbGVjdG9yKSB7XG4gICAgICAgIHZhciBmID0gZ2V0RmlsdGVyRnVuYyhzZWxlY3Rvcik7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgcmV0dXJuIGYodikgPyBfbnVsbCA6IHRydWU7XG4gICAgICAgIH07XG4gICAgfVxuICAgIGZ1bmN0aW9uIGZsZXhpRWFjaChsaXN0LCBjYikge1xuICAgICAgICBpZiAoaXNMaXN0KGxpc3QpKVxuICAgICAgICAgICAgZWFjaChsaXN0LCBjYik7XG4gICAgICAgIGVsc2UgaWYgKGxpc3QgIT0gX251bGwpXG4gICAgICAgICAgICBjYihsaXN0LCAwKTtcbiAgICAgICAgcmV0dXJuIGxpc3Q7XG4gICAgfVxuICAgIGZ1bmN0aW9uIFByb21pc2UoKSB7XG4gICAgICAgIHRoaXNbJ3N0YXRlJ10gPSBudWxsO1xuICAgICAgICB0aGlzWyd2YWx1ZXMnXSA9IFtdO1xuICAgICAgICB0aGlzWydwYXJlbnQnXSA9IG51bGw7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHByb21pc2UoKSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9IFtdO1xuICAgICAgICB2YXIgYXNzaW1pbGF0ZWRQcm9taXNlcyA9IGFyZ3VtZW50cztcbiAgICAgICAgdmFyIGFzc2ltaWxhdGVkTnVtID0gYXNzaW1pbGF0ZWRQcm9taXNlcy5sZW5ndGg7XG4gICAgICAgIHZhciBudW1Db21wbGV0ZWQgPSAwO1xuICAgICAgICB2YXIgcmVqZWN0aW9uSGFuZGxlck51bSA9IDA7XG4gICAgICAgIHZhciBvYmogPSBuZXcgUHJvbWlzZSgpO1xuICAgICAgICBvYmpbJ2VyckhhbmRsZWQnXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJlamVjdGlvbkhhbmRsZXJOdW0rKztcbiAgICAgICAgICAgIGlmIChvYmpbJ3BhcmVudCddKVxuICAgICAgICAgICAgICAgIG9ialsncGFyZW50J11bJ2VyckhhbmRsZWQnXSgpO1xuICAgICAgICB9O1xuICAgICAgICB2YXIgZmlyZSA9IG9ialsnZmlyZSddID0gZnVuY3Rpb24gKG5ld1N0YXRlLCBuZXdWYWx1ZXMpIHtcbiAgICAgICAgICAgIGlmIChvYmpbJ3N0YXRlJ10gPT0gbnVsbCAmJiBuZXdTdGF0ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgb2JqWydzdGF0ZSddID0gISFuZXdTdGF0ZTtcbiAgICAgICAgICAgICAgICBvYmpbJ3ZhbHVlcyddID0gaXNMaXN0KG5ld1ZhbHVlcykgPyBuZXdWYWx1ZXMgOiBbbmV3VmFsdWVzXTtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgZWFjaChkZWZlcnJlZCwgZnVuY3Rpb24gKGYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGYoKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9O1xuICAgICAgICBlYWNoKGFzc2ltaWxhdGVkUHJvbWlzZXMsIGZ1bmN0aW9uIGFzc2ltaWxhdGUocHJvbWlzZSwgaW5kZXgpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKHByb21pc2VbJ3RoZW4nXSlcbiAgICAgICAgICAgICAgICAgICAgcHJvbWlzZVsndGhlbiddKGZ1bmN0aW9uICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdGhlbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgoaXNPYmplY3QodikgfHwgaXNGdW5jdGlvbih2KSkgJiYgaXNGdW5jdGlvbih0aGVuID0gdlsndGhlbiddKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NpbWlsYXRlKHYsIGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ialsndmFsdWVzJ11baW5kZXhdID0gYXJyYXkoYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoKytudW1Db21wbGV0ZWQgPT0gYXNzaW1pbGF0ZWROdW0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpcmUodHJ1ZSwgYXNzaW1pbGF0ZWROdW0gPCAyID8gb2JqWyd2YWx1ZXMnXVtpbmRleF0gOiBvYmpbJ3ZhbHVlcyddKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9ialsndmFsdWVzJ11baW5kZXhdID0gYXJyYXkoYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpcmUoZmFsc2UsIGFzc2ltaWxhdGVkTnVtIDwgMiA/IG9ialsndmFsdWVzJ11baW5kZXhdIDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ialsndmFsdWVzJ11baW5kZXhdWzBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ialsndmFsdWVzJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXhcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHByb21pc2UoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZmlyZSh0cnVlLCBhcnJheShhcmd1bWVudHMpKTtcbiAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZmlyZShmYWxzZSwgYXJyYXkoYXJndW1lbnRzKSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGZpcmUoZmFsc2UsIFtcbiAgICAgICAgICAgICAgICAgICAgZSxcbiAgICAgICAgICAgICAgICAgICAgb2JqWyd2YWx1ZXMnXSxcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhcbiAgICAgICAgICAgICAgICBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIG9ialsnc3RvcCddID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZWFjaChhc3NpbWlsYXRlZFByb21pc2VzLCBmdW5jdGlvbiAocHJvbWlzZSkge1xuICAgICAgICAgICAgICAgIGlmIChwcm9taXNlWydzdG9wJ10pXG4gICAgICAgICAgICAgICAgICAgIHByb21pc2VbJ3N0b3AnXSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gb2JqWydzdG9wMCddICYmIGNhbGwob2JqWydzdG9wMCddKTtcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIHRoZW4gPSBvYmpbJ3RoZW4nXSA9IGZ1bmN0aW9uIChvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkge1xuICAgICAgICAgICAgdmFyIHByb21pc2UyID0gcHJvbWlzZSgpO1xuICAgICAgICAgICAgdmFyIGNhbGxDYWxsYmFja3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGYgPSBvYmpbJ3N0YXRlJ10gPyBvbkZ1bGZpbGxlZCA6IG9uUmVqZWN0ZWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0Z1bmN0aW9uKGYpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAoZnVuY3Rpb24gcmVzb2x2ZSh4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRoZW4sIGNiQ2FsbGVkID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKChpc09iamVjdCh4KSB8fCBpc0Z1bmN0aW9uKHgpKSAmJiBpc0Z1bmN0aW9uKHRoZW4gPSB4Wyd0aGVuJ10pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoeCA9PT0gcHJvbWlzZTIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhlbi5jYWxsKHgsIGZ1bmN0aW9uICh4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjYkNhbGxlZCsrKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjYkNhbGxlZCsrKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9taXNlMlsnZmlyZSddKGZhbHNlLCBbdmFsdWVdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvbWlzZTJbJ3N0b3AwJ10gPSB4WydzdG9wJ107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvbWlzZTJbJ2ZpcmUnXSh0cnVlLCBbeF0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjYkNhbGxlZCsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9taXNlMlsnZmlyZSddKGZhbHNlLCBbZV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFyZWplY3Rpb25IYW5kbGVyTnVtKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KGNhbGwoZiwgdW5kZWYsIG9ialsndmFsdWVzJ10pKSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvbWlzZTJbJ2ZpcmUnXShvYmpbJ3N0YXRlJ10sIG9ialsndmFsdWVzJ10pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvbWlzZTJbJ2ZpcmUnXShmYWxzZSwgW2VdKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyZWplY3Rpb25IYW5kbGVyTnVtKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGlzRnVuY3Rpb24ob25SZWplY3RlZCkpXG4gICAgICAgICAgICAgICAgb2JqWydlcnJIYW5kbGVkJ10oKTtcbiAgICAgICAgICAgIHByb21pc2UyWydzdG9wMCddID0gb2JqWydzdG9wJ107XG4gICAgICAgICAgICBwcm9taXNlMlsncGFyZW50J10gPSBvYmo7XG4gICAgICAgICAgICBpZiAob2JqWydzdGF0ZSddICE9IG51bGwpXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChjYWxsQ2FsbGJhY2tzLCAwKTtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5wdXNoKGNhbGxDYWxsYmFja3MpO1xuICAgICAgICAgICAgcmV0dXJuIHByb21pc2UyO1xuICAgICAgICB9O1xuICAgICAgICBvYmpbJ2Fsd2F5cyddID0gZnVuY3Rpb24gKGZ1bmMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGVuKGZ1bmMsIGZ1bmMpO1xuICAgICAgICB9O1xuICAgICAgICBvYmpbJ2Vycm9yJ10gPSBmdW5jdGlvbiAoZnVuYykge1xuICAgICAgICAgICAgcmV0dXJuIHRoZW4oMCwgZnVuYyk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuICAgIGZ1bmN0aW9uIE0obGlzdCwgYXNzaW1pbGF0ZVN1Ymxpc3RzKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgaWR4ID0gMDtcbiAgICAgICAgaWYgKGxpc3QpXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gbGlzdC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBpdGVtID0gbGlzdFtpXTtcbiAgICAgICAgICAgICAgICBpZiAoYXNzaW1pbGF0ZVN1Ymxpc3RzICYmIGlzTGlzdChpdGVtKSlcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaiA9IDAsIGxlbjIgPSBpdGVtLmxlbmd0aDsgaiA8IGxlbjI7IGorKylcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGZbaWR4KytdID0gaXRlbVtqXTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHNlbGZbaWR4KytdID0gaXRlbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgc2VsZltpZHgrK10gPSBhc3NpbWlsYXRlU3VibGlzdHM7XG4gICAgICAgIHNlbGZbJ2xlbmd0aCddID0gaWR4O1xuICAgICAgICBzZWxmWydfJ10gPSB0cnVlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBfKCkge1xuICAgICAgICByZXR1cm4gbmV3IE0oYXJndW1lbnRzLCB0cnVlKTtcbiAgICB9XG4gICAgY29weU9iaih7XG4gICAgICAgICdlYWNoJzogbGlzdEJpbmQoZWFjaCksXG4gICAgICAgICdlcXVhbHMnOiBsaXN0QmluZChlcXVhbHMpLFxuICAgICAgICAnZmluZCc6IGxpc3RCaW5kKGZpbmQpLFxuICAgICAgICBkdW1teVNvcnQ6IDAsXG4gICAgICAgICdzZWxlY3QnOiBmdW5jdGlvbiAoc2VsZWN0b3IsIGNoaWxkT25seSkge1xuICAgICAgICAgICAgcmV0dXJuICQoc2VsZWN0b3IsIHRoaXMsIGNoaWxkT25seSk7XG4gICAgICAgIH0sXG4gICAgICAgICdnZXQnOiBmdW5jdGlvbiAoc3BlYywgdG9OdW1iZXIpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHZhciBlbGVtZW50ID0gc2VsZlswXTtcbiAgICAgICAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzU3RyaW5nKHNwZWMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBtYXRjaCA9IC9eKFxcVyopKC4qKS8uZXhlYyhyZXBsYWNlKHNwZWMsIC9eJS8sICdAZGF0YS0nKSk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwcmVmaXggPSBtYXRjaFsxXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHM7XG4gICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXJbcHJlZml4XSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHMgPSBnZXR0ZXJbcHJlZml4XSh0aGlzLCBtYXRjaFsyXSk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKHNwZWMgPT0gJyQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgcyA9IHNlbGZbJ2dldCddKCdjbGFzc05hbWUnKTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoc3BlYyA9PSAnJCQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzID0gc2VsZlsnZ2V0J10oJ0BzdHlsZScpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHNwZWMgPT0gJyQkc2xpZGUnKVxuICAgICAgICAgICAgICAgICAgICAgICAgcyA9IHNlbGZbJ2dldCddKCckaGVpZ2h0Jyk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKHNwZWMgPT0gJyQkZmFkZScgfHwgc3BlYyA9PSAnJCRzaG93Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGZbJ2dldCddKCckdmlzaWJpbGl0eScpID09ICdoaWRkZW4nIHx8IHNlbGZbJ2dldCddKCckZGlzcGxheScpID09ICdub25lJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKHNwZWMgPT0gJyQkZmFkZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzID0gaXNOYU4oc2VsZlsnZ2V0J10oJyRvcGFjaXR5JywgdHJ1ZSkpID8gMSA6IHNlbGZbJ2dldCddKCckb3BhY2l0eScsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcyA9IDE7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocHJlZml4ID09ICckJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcyA9IF93aW5kb3dbJ2dldENvbXB1dGVkU3R5bGUnXShlbGVtZW50LCBfbnVsbClbJ2dldFByb3BlcnR5VmFsdWUnXShyZXBsYWNlKG1hdGNoWzJdLCAvW0EtWl0vZywgZnVuY3Rpb24gKG1hdGNoMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnLScgKyBtYXRjaDIudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwcmVmaXggPT0gJ0AnKVxuICAgICAgICAgICAgICAgICAgICAgICAgcyA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKG1hdGNoWzJdKTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgcyA9IGVsZW1lbnRbbWF0Y2hbMl1dO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdG9OdW1iZXIgPyBleHRyYWN0TnVtYmVyKHMpIDogcztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2YXIgciA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAoaXNMaXN0KHNwZWMpID8gZmxleGlFYWNoIDogZWFjaE9iaikoc3BlYywgZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJbbmFtZV0gPSBzZWxmWydnZXQnXShuYW1lLCB0b051bWJlcik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgICdzZXQnOiBmdW5jdGlvbiAobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWYpIHtcbiAgICAgICAgICAgICAgICB2YXIgbWF0Y2ggPSAvXihcXFcqKSguKikvLmV4ZWMocmVwbGFjZShyZXBsYWNlKG5hbWUsIC9eXFwkZmxvYXQkLywgJ2Nzc0Zsb2F0JyksIC9eJS8sICdAZGF0YS0nKSk7XG4gICAgICAgICAgICAgICAgdmFyIHByZWZpeCA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgICAgIGlmIChzZXR0ZXJbcHJlZml4XSlcbiAgICAgICAgICAgICAgICAgICAgc2V0dGVyW3ByZWZpeF0odGhpcywgbWF0Y2hbMl0sIHZhbHVlKTtcbiAgICAgICAgICAgICAgICBlbHNlIGlmIChuYW1lID09ICckJGZhZGUnKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbJ3NldCddKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICckdmlzaWJpbGl0eSc6IHZhbHVlID8gJ3Zpc2libGUnIDogJ2hpZGRlbicsXG4gICAgICAgICAgICAgICAgICAgICAgICAnJG9wYWNpdHknOiB2YWx1ZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG5hbWUgPT0gJyQkc2xpZGUnKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGZbJ3NldCddKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICckdmlzaWJpbGl0eSc6IHZhbHVlID8gJ3Zpc2libGUnIDogJ2hpZGRlbicsXG4gICAgICAgICAgICAgICAgICAgICAgICAnJG92ZXJmbG93JzogJ2hpZGRlbicsXG4gICAgICAgICAgICAgICAgICAgICAgICAnJGhlaWdodCc6IC9weC8udGVzdCh2YWx1ZSkgPyB2YWx1ZSA6IGZ1bmN0aW9uIChvbGRWYWx1ZSwgaWR4LCBlbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGdldE5hdHVyYWxIZWlnaHQoJChlbGVtZW50KSwgdmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG5hbWUgPT0gJyQkc2hvdycpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZlsnc2V0J10oe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICckdmlzaWJpbGl0eSc6IHZhbHVlID8gJ3Zpc2libGUnIDogJ2hpZGRlbicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJyRkaXNwbGF5JzogJydcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pWydzZXQnXSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJyRkaXNwbGF5JzogZnVuY3Rpb24gKG9sZFZhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2xkVmFsID09ICdub25lJyA/ICdibG9jaycgOiBvbGRWYWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGZbJ3NldCddKHsgJyRkaXNwbGF5JzogJ25vbmUnIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobmFtZSA9PSAnJCQnKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGZbJ3NldCddKCdAc3R5bGUnLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlXG4gICAgICAgICAgICAgICAgICAgIGZsZXhpRWFjaCh0aGlzLCBmdW5jdGlvbiAob2JqLCBjKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbmV3VmFsdWUgPSBpc0Z1bmN0aW9uKHZhbHVlKSA/IHZhbHVlKCQob2JqKVsnZ2V0J10obmFtZSksIGMsIG9iaikgOiB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVmaXggPT0gJyQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoWzJdKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmpbJ3N0eWxlJ11bbWF0Y2hbMl1dID0gbmV3VmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZsZXhpRWFjaChuZXdWYWx1ZSAmJiBuZXdWYWx1ZS5zcGxpdCgvXFxzKy8pLCBmdW5jdGlvbiAoY2x6eikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNOYW1lID0gcmVwbGFjZShjbHp6LCAvXlsrLV0vKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgvXlxcKy8udGVzdChjbHp6KSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmpbJ2NsYXNzTGlzdCddLmFkZChjTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICgvXi0vLnRlc3QoY2x6eikpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqWydjbGFzc0xpc3QnXS5yZW1vdmUoY05hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ialsnY2xhc3NMaXN0J10udG9nZ2xlKGNOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChuYW1lID09ICckJHNjcm9sbFgnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9ialsnc2Nyb2xsJ10obmV3VmFsdWUsICQob2JqKVsnZ2V0J10oJyQkc2Nyb2xsWScpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKG5hbWUgPT0gJyQkc2Nyb2xsWScpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqWydzY3JvbGwnXSgkKG9iailbJ2dldCddKCckJHNjcm9sbFgnKSwgbmV3VmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAocHJlZml4ID09ICdAJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdWYWx1ZSA9PSBfbnVsbClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqLnJlbW92ZUF0dHJpYnV0ZShtYXRjaFsyXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmouc2V0QXR0cmlidXRlKG1hdGNoWzJdLCBuZXdWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmpbbWF0Y2hbMl1dID0gbmV3VmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpc1N0cmluZyhuYW1lKSB8fCBpc0Z1bmN0aW9uKG5hbWUpKVxuICAgICAgICAgICAgICAgIHNlbGZbJ3NldCddKCckJywgbmFtZSk7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgZWFjaE9iaihuYW1lLCBmdW5jdGlvbiAobiwgdikge1xuICAgICAgICAgICAgICAgICAgICBzZWxmWydzZXQnXShuLCB2KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBzZWxmO1xuICAgICAgICB9LFxuICAgICAgICAnYWRkJzogZnVuY3Rpb24gKGNoaWxkcmVuLCBhZGRGdW5jdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNbJ2VhY2gnXShmdW5jdGlvbiAoZSwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICB2YXIgbGFzdEFkZGVkO1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGFwcGVuZENoaWxkcmVuKGMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzTGlzdChjKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGZsZXhpRWFjaChjLCBhcHBlbmRDaGlsZHJlbik7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGlzRnVuY3Rpb24oYykpXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHBlbmRDaGlsZHJlbihjKGUsIGluZGV4KSk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGMgIT0gX251bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuID0gaXNOb2RlKGMpID8gYyA6IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxhc3RBZGRlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0QWRkZWRbJ3BhcmVudE5vZGUnXVsnaW5zZXJ0QmVmb3JlJ10obiwgbGFzdEFkZGVkWyduZXh0U2libGluZyddKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGFkZEZ1bmN0aW9uKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZEZ1bmN0aW9uKG4sIGUsIGVbJ3BhcmVudE5vZGUnXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5hcHBlbmRDaGlsZChuKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RBZGRlZCA9IG47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYXBwZW5kQ2hpbGRyZW4oaW5kZXggJiYgIWlzRnVuY3Rpb24oY2hpbGRyZW4pID8gY2xvbmUoY2hpbGRyZW4pIDogY2hpbGRyZW4pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgICdvbic6IG9uLFxuICAgICAgICAndHJpZ2dlcic6IGZ1bmN0aW9uIChldmVudE5hbWUsIGV2ZW50T2JqKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpc1snZWFjaCddKGZ1bmN0aW9uIChlbGVtZW50LCBpbmRleCkge1xuICAgICAgICAgICAgICAgIHZhciBidWJibGVPbiA9IHRydWUsIGVsID0gZWxlbWVudDtcbiAgICAgICAgICAgICAgICB3aGlsZSAoZWwgJiYgYnViYmxlT24pIHtcbiAgICAgICAgICAgICAgICAgICAgZWFjaE9iaihlbFsnTSddLCBmdW5jdGlvbiAoaWQsIGYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1YmJsZU9uID0gYnViYmxlT24gJiYgZihldmVudE5hbWUsIGV2ZW50T2JqLCBlbGVtZW50KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGVsID0gZWxbJ3BhcmVudE5vZGUnXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgJ2h0JzogZnVuY3Rpb24gKGh0bWxUZW1wbGF0ZSwgb2JqZWN0KSB7XG4gICAgICAgICAgICB2YXIgbyA9IGFyZ3VtZW50cy5sZW5ndGggPiAyID8gbWVyZ2Uoc3ViKGFyZ3VtZW50cywgMSkpIDogb2JqZWN0O1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNbJ3NldCddKCdpbm5lckhUTUwnLCBpc0Z1bmN0aW9uKGh0bWxUZW1wbGF0ZSkgPyBodG1sVGVtcGxhdGUobykgOiAve3svLnRlc3QoaHRtbFRlbXBsYXRlKSA/IGZvcm1hdEh0bWwoaHRtbFRlbXBsYXRlLCBvKSA6IC9eI1xcUyskLy50ZXN0KGh0bWxUZW1wbGF0ZSkgPyBmb3JtYXRIdG1sKCQkKGh0bWxUZW1wbGF0ZSlbJ3RleHQnXSwgbykgOiBodG1sVGVtcGxhdGUpO1xuICAgICAgICB9XG4gICAgfSwgTS5wcm90b3R5cGUpO1xuICAgIGNvcHlPYmooe1xuICAgICAgICAncmVxdWVzdCc6IGZ1bmN0aW9uIChtZXRob2QsIHVybCwgZGF0YSwgc2V0dGluZ3MwKSB7XG4gICAgICAgICAgICB2YXIgc2V0dGluZ3MgPSBzZXR0aW5nczAgfHwge307XG4gICAgICAgICAgICB2YXIgeGhyLCBjYWxsYmFja0NhbGxlZCA9IDAsIHByb20gPSBwcm9taXNlKCksIGRhdGFJc01hcCA9IGRhdGEgJiYgZGF0YVsnY29uc3RydWN0b3InXSA9PSBzZXR0aW5nc1snY29uc3RydWN0b3InXTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcHJvbVsneGhyJ10gPSB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgICAgICAgICBwcm9tWydzdG9wMCddID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB4aHJbJ2Fib3J0J10oKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmIChkYXRhSXNNYXApIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YSA9IGNvbGxlY3RvcihlYWNoT2JqLCBkYXRhLCBmdW5jdGlvbiBwcm9jZXNzUGFyYW0ocGFyYW1OYW1lLCBwYXJhbVZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29sbGVjdG9yKGZsZXhpRWFjaCwgcGFyYW1WYWx1ZSwgZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHBhcmFtTmFtZSkgKyAodiAhPSBfbnVsbCA/ICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2KSA6ICcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KS5qb2luKCcmJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChkYXRhICE9IF9udWxsICYmICEvcG9zdC9pLnRlc3QobWV0aG9kKSkge1xuICAgICAgICAgICAgICAgICAgICB1cmwgKz0gJz8nICsgZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YSA9IF9udWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB4aHJbJ29wZW4nXShtZXRob2QsIHVybCwgdHJ1ZSwgc2V0dGluZ3NbJ3VzZXInXSwgc2V0dGluZ3NbJ3Bhc3MnXSk7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGFJc01hcCAmJiAvcG9zdC9pLnRlc3QobWV0aG9kKSlcbiAgICAgICAgICAgICAgICAgICAgeGhyWydzZXRSZXF1ZXN0SGVhZGVyJ10oJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnKTtcbiAgICAgICAgICAgICAgICBlYWNoT2JqKHNldHRpbmdzWydoZWFkZXJzJ10sIGZ1bmN0aW9uIChoZHJOYW1lLCBoZHJWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICB4aHJbJ3NldFJlcXVlc3RIZWFkZXInXShoZHJOYW1lLCBoZHJWYWx1ZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgZWFjaE9iaihzZXR0aW5nc1sneGhyJ10sIGZ1bmN0aW9uIChuYW1lLCB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICB4aHJbbmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB4aHJbJ29ucmVhZHlzdGF0ZWNoYW5nZSddID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoeGhyWydyZWFkeVN0YXRlJ10gPT0gNCAmJiAhY2FsbGJhY2tDYWxsZWQrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHhoclsnc3RhdHVzJ10gPj0gMjAwICYmIHhoclsnc3RhdHVzJ10gPCAzMDApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvbVsnZmlyZSddKHRydWUsIFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeGhyWydyZXNwb25zZVRleHQnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeGhyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvbVsnZmlyZSddKGZhbHNlLCBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHhoclsnc3RhdHVzJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHhoclsncmVzcG9uc2VUZXh0J10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHhoclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB4aHJbJ3NlbmQnXShkYXRhKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNhbGxiYWNrQ2FsbGVkKVxuICAgICAgICAgICAgICAgICAgICBwcm9tWydmaXJlJ10oZmFsc2UsIFtcbiAgICAgICAgICAgICAgICAgICAgICAgIDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBfbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvU3RyaW5nKGUpXG4gICAgICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByb207XG4gICAgICAgIH0sXG4gICAgICAgICdyZWFkeSc6IHJlYWR5LFxuICAgICAgICAnb2ZmJzogb2ZmLFxuICAgICAgICAnd2FpdCc6IGZ1bmN0aW9uIChkdXJhdGlvbk1zLCBhcmdzKSB7XG4gICAgICAgICAgICB2YXIgcCA9IHByb21pc2UoKTtcbiAgICAgICAgICAgIHZhciBpZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHBbJ2ZpcmUnXSh0cnVlLCBhcmdzKTtcbiAgICAgICAgICAgIH0sIGR1cmF0aW9uTXMpO1xuICAgICAgICAgICAgcFsnc3RvcDAnXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBwWydmaXJlJ10oZmFsc2UpO1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dChpZCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIHA7XG4gICAgICAgIH1cbiAgICB9LCAkKTtcbiAgICBjb3B5T2JqKHtcbiAgICAgICAgJ2VhY2gnOiBlYWNoLFxuICAgICAgICAndG9PYmplY3QnOiB0b09iamVjdCxcbiAgICAgICAgJ2ZpbmQnOiBmaW5kLFxuICAgICAgICAnZXF1YWxzJzogZXF1YWxzLFxuICAgICAgICAnY29weU9iaic6IGNvcHlPYmosXG4gICAgICAgICdleHRlbmQnOiBmdW5jdGlvbiAodGFyZ2V0KSB7XG4gICAgICAgICAgICByZXR1cm4gbWVyZ2Uoc3ViKGFyZ3VtZW50cywgMSksIHRhcmdldCk7XG4gICAgICAgIH0sXG4gICAgICAgICdlYWNoT2JqJzogZWFjaE9iaixcbiAgICAgICAgJ2lzT2JqZWN0JzogaXNPYmplY3QsXG4gICAgICAgICdmb3JtYXQnOiBmdW5jdGlvbiAodHBsLCBvYmplY3QsIGVzY2FwZUZ1bmN0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gdGVtcGxhdGUodHBsLCBlc2NhcGVGdW5jdGlvbikob2JqZWN0KTtcbiAgICAgICAgfSxcbiAgICAgICAgJ3RlbXBsYXRlJzogdGVtcGxhdGUsXG4gICAgICAgICdmb3JtYXRIdG1sJzogZm9ybWF0SHRtbCxcbiAgICAgICAgJ3Byb21pc2UnOiBwcm9taXNlXG4gICAgfSwgXyk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2FsbExpc3QoRE9NUkVBRFlfSEFORExFUik7XG4gICAgICAgIERPTVJFQURZX0hBTkRMRVIgPSBfbnVsbDtcbiAgICB9LCBmYWxzZSk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgJ0hUTUwnOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZGl2ID0gRUUoJ2RpdicpO1xuICAgICAgICAgICAgcmV0dXJuIF8oY2FsbChkaXZbJ2h0J10sIGRpdiwgYXJndW1lbnRzKVswXS5jaGlsZE5vZGVzKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ18nOiBfLFxuICAgICAgICAnJCc6ICQsXG4gICAgICAgICckJCc6ICQkLFxuICAgICAgICAnTSc6IE0sXG4gICAgICAgICdnZXR0ZXInOiBnZXR0ZXIsXG4gICAgICAgICdzZXR0ZXInOiBzZXR0ZXJcbiAgICB9O1xufSgpOyJdfQ==
