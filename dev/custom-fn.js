module.exports = function(minified) {

  var clayConfig = this;
  var _ = minified._;
  var $ = minified.$;
  var HTML = minified.HTML;
window.onload = function() {
  
}
clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function() {

  // var button_types = ['up', 'up_hold', 'mid', 'mid_hold', 'down', 'down_hold']
  var submitButton = clayConfig.getItemById('Submit');
  // var addTile = clayConfig.getItemById('AddTile');

  var items = clayConfig.getItemsByGroup('tile.0');
  // var header = clayConfig.getItemById('tile$0');
  // var up_type = clayConfig.getItemById('up_type_0')
  var textarea = $("textarea");
  $(textarea).on('input', function() {
    this.set('$height', 'auto');
    this.set('$height', this[0].scrollHeight + "px");
  });
  $(textarea).trigger('input');
  var clayJSON = clayConfig.getItemById('ClayJSON');
  var claySubmit = clayConfig.getItemById('ClaySubmit');
  clayJSON.hide();
  clayJSON.set('');
  claySubmit.hide();

//   iconButton.on('click', function() {
//     var t_json = {"action": "LoadIcon", "payload": clayConfig.getItemById('0_iurl').get()};
//     clayJSON.set(JSON.stringify(t_json));
//     claySubmit.trigger('submit');
//     });
  // addTile.on('click', function() {
  //     var t_json = {"action": "AddTile"};
  //     clayJSON.set(JSON.stringify(t_json));
  //     claySubmit.trigger('submit');
  //   });

  // var toggle = true;
  // header.on('click', function() {
  //   toggle = !toggle;
  //   if (toggle) {
  //     items.forEach(function(i) {i.show();})
  //   } else {
  //     items.forEach(function(i) {i.hide();})
  //   }
  // });

  // up_type.on('change', function() {
  //   clayConfig.getAllItems().filter(function(elm) {
  //     return elm.id != null && elm.id.startsWith('up.')
  //   }).forEach(function(elm) {
  //     if (up_type.get('value') == 'rest') {
  //       elm.show();
  //     } else {
  //       elm.hide();
  //     }
  //   });
  // })
  // up_type.trigger('change');

  submitButton.on('click', function () {
      // var failed_items = $('div', 'form', false).find(function(elm, idx ){ 
      //                       if ($(elm).get('$display') != 'none') { 
      //                         var input = $('input', elm, false)[0];
      //                         if (input != null && !input.reportValidity()) {
      //                           return elm; 
      //                         }
      //                       }
      //                     });
      // if (failed_items != null) { return; }

      var t_json = {"action": "Submit", "payload": []};
      var items = clayConfig.getAllItems();
      items.forEach(function(item, index) {
        var t_dict = { "id": item.id, "value": item.get() };
        console.log(JSON.stringify(t_dict));
         t_json.payload.push(t_dict);
       });
      clayJSON.set(JSON.stringify(t_json));
      // clayConfig.getItemById('')
      claySubmit.trigger('submit');
    });
  });
};
