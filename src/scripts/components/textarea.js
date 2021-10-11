'use strict';

module.exports = {
  name: 'textarea',
  template: require('../../templates/components/textarea.tpl'),
  style: require('../../styles/clay/components/textarea.scss'),
  manipulator: 'val',
  defaults: {
    label: '',
    description: '',
    attributes: {}
  }
};
