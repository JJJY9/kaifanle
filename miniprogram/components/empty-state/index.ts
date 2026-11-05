Component({
  properties: {
    title: { type: String, value: '还什么都没有' },
    desc: { type: String, value: '' },
    actionText: { type: String, value: '' }
  },

  methods: {
    onAction() {
      this.triggerEvent('action')
    }
  }
})
