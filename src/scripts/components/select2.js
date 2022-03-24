
module.exports = {
  name: 'select2',
  template: require('../../templates/components/select2.tpl'),
  style: require('../../styles/clay/components/select.scss'),
  manipulator: 'val',
  defaults: {
    label: '',
    src: '',
    options: [],
    description: '',
    attributes: {}
  },
  initialize: function() {
    var self = this;

    var $value = self.$element.select('.image');

    /**
     * Updates the HTML value of the component to match the slected option's label
     * @return {void}
     */
    function setImageDisplay() {
      var selectedIndex = self.$manipulatorTarget.get('selectedIndex');
      var $options = self.$manipulatorTarget.select('option');
      var value = $options[selectedIndex];
      if (value) {$value.set('@src', value.getAttribute('src'))};
    }

    setImageDisplay();
    self.on('change', setImageDisplay);
  }
};
