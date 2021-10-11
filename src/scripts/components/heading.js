'use strict';

module.exports = {
  name: 'heading',
  template: require('../../templates/components/heading.tpl'),
  style: require('../../styles/clay/components/heading.scss'),
  manipulator: 'html',
  defaults: {
    size: 4
  },
  initialize: function() {
    var self = this;
    console.log("hello");
    var toggle = false;

    self.on('click', function() {
      self.$element.set('$', 'hidden')
    });
  }
};
