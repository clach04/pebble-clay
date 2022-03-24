'use strict';

module.exports = {
  name: 'heading2',
  template: require('../../templates/components/heading2.tpl'),
  style: require('../../styles/clay/components/heading2.scss'),
  manipulator: 'html',
  defaults: {
    size: 4
  },
  initialize: function() {
    var self = this;

    self.on('click', function() {
      self.$element.set('$', 'hidden')
    });
  }
};
