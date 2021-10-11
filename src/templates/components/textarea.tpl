<div class="component component-textarea">
  <label class="tap-highlight">
    <span class="label">{{{label}}}</span>
      <textarea
      data-manipulator-target
        {{each key: attributes}}{{key}}="{{this}}"{{/each}}
      "/>
  </label>
  {{if description}}
    <div class="description">{{{description}}}</div>
  {{/if}}
</div>
