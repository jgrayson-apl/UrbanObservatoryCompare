define([
  "dojo/Evented",
  "dojo/_base/declare",
  "dojo/_base/lang"
], function(Evented, declare, lang){
  /**
   * apl.UOBusyStatus
   */
  return declare([Evented], {

    /**
     * DECLARED CLASS
     */
    declaredClass: 'apl.UOBusyStatus',

    /**
     *  STATUS ENUMS
     */
    STATUS_NOTBUSY: 0,
    STATUS_LESSBUSY: -1,
    STATUS_MOREBUSY: 1,

    /**
     * CURRENT STATUS
     */
    _status: 0,

    /**
     *
     * @param options
     */
    constructor: function(options){
      declare.safeMixin(this, options);
      this._status = this.STATUS_NOTBUSY;
    },

    /**
     * isBusy
     *
     * @returns {boolean}
     */
    isBusy: function(){
      return (this._status > this.STATUS_NOTBUSY);
    },

    /**
     * updateStatus
     *
     * @param {Number} update
     */
    updateStatus: function(update){
      if(update){
        var previousStatus = this._status;
        this._status += update;
        if(this._status !== previousStatus){
          this.emit('status-change', this._status);
        }
      }
    },

    /**
     * setMoreBusy
     */
    setMoreBusy: function(){
      this.updateStatus(this.STATUS_MOREBUSY);
    },

    /**
     * setLessBusy
     */
    setLessBusy: function(){
      this.updateStatus(this.STATUS_LESSBUSY);
    },

    /**
     * reset
     */
    reset: function(){
      this._status = this.STATUS_NOTBUSY;
      this.emit('status-change', this._status);
    }

  });
});
