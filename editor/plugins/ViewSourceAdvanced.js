define([
    "dojo/array", // array.forEach
    "dojo/_base/connect", // connect.connect connect.disconnect
    "dojo/_base/declare", // declare
    "dojo/dom-attr", // domAttr.set
    "dojo/dom-construct", // domConstruct.create domConstruct.place
    "dojo/dom-geometry", // domGeometry.setMarginBox domGeometry.position
    "dojo/dom-style", // domStyle.set
    "dojo/_base/event", // event.stop
    "dojo/i18n", // i18n.getLocalization
    "dojo/keys",    //  keys.F12
    "dojo/_base/lang", // lang.hitch
    "dojo/_base/sniff", // has("ie") has("webkit")
    "dojo/_base/window", // win.body win.global
    "dojo/window", // winUtils.getBox
    "dijit/focus",    // focus.focus()
    "dijit/_editor/_Plugin",
    "dijit/form/ToggleButton",
    "dijit",    // dijit._scopeName
    "dijit/registry", // registry.getEnclosingWidget()
    "dijit-ace/editor/TextEditor",
    "dojo/i18n!dijit/_editor/nls/commands"
], function(array, connect, declare, domAttr, domConstruct, domGeometry, domStyle, event, i18n, keys, lang, has, win,
    winUtils, focus, _Plugin, ToggleButton, dijit, registry, TextEditor){

/*=====
    var _Plugin = dijit._editor._Plugin;
=====*/

// module:
//      dijit-ace/editor/plugins/ViewSourceAdvanced
// summary:
//      This plugin provides a more advanced view source capability.


var ViewSourceAdvanced = declare(_Plugin, {
    // summary:
    //      This plugin provides a simple view source capability.  When view
    //      source mode is enabled, it disables all other buttons/plugins on the RTE.
    //      It also binds to the hotkey: CTRL-SHIFT-F11 for toggling ViewSource mode.
    
    // mode: [public] Boolean
    //      Whether the editor opens directly in this context.
    //      Defaults to false.
    init: false,

    // mode: [public] String
    //      String which determines which syntax highlighting mode to load.
    //      Defaults to "text".
    mode: null,

    // theme: [public] String
    //      String which determines which theme to load for the editor.
    //      Defaults to "crimson_editor".
    theme: null,

    // stripScripts: [public] Boolean
    //      Boolean flag used to indicate if script tags should be stripped from the document.
    //      Defaults to true.
    stripScripts: true,

    // stripComments: [public] Boolean
    //      Boolean flag used to indicate if comment tags should be stripped from the document.
    //      Defaults to true.
    stripComments: true,

    // stripComments: [public] Boolean
    //      Boolean flag used to indicate if iframe tags should be stripped from the document.
    //      Defaults to true.
    stripIFrames: true,

    // readOnly: [const] Boolean
    //      Boolean flag used to indicate if the source view should be readonly or not.
    //      Cannot be changed after initialization of the plugin.
    //      Defaults to false.
    readOnly: false,

    // _fsPlugin: [private] Object
    //      Reference to a registered fullscreen plugin so that viewSource knows
    //      how to scale.
    _fsPlugin: null,

    toggle: function(){
        // summary:
        //      Function to allow programmatic toggling of the view.
        this.button.set("checked", !this.button.get("checked"));
    },

    _initButton: function(){
        // summary:
        //      Over-ride for creation of the resize button.
        var strings = i18n.getLocalization("dijit._editor", "commands");
        var editor = this.editor;
        this.button = new ToggleButton({
            label: strings["viewSourceAdvanced"] || "Advanced View Source",
            dir: editor.dir,
            lang: editor.lang,
            showLabel: false,
            iconClass: this.iconClassPrefix + " " + this.iconClassPrefix + "ViewSource",
            tabIndex: "-1",
            onChange: lang.hitch(this, "_showSource")
        });

        /* is this necessary?
        // Make sure readonly mode doesn't make the wrong cursor appear over the button.
        this.button.set("readOnly", false);*/
    },


    setEditor: function(/*dijit.Editor*/ editor){
        // summary:
        //      Tell the plugin which Editor it is associated with.
        // editor: Object
        //      The editor object to attach the print capability to.
        this.editor = editor;
        this._initButton();

        // Use `init` param for instantiatation
        if (this.init === "locked") this.button.set("disabled", true);
        if (this.init) this.button.set("checked", true);

        // TODO set up key handler
    },

    _showSource: function(source) {
        // summary:
        //      Function to toggle between the source and RTE views.
        // source: boolean
        //      Boolean value indicating if it should be in source mode or not.
        // tags:
        //      private
        var ed = this.editor;
        var edPlugins = ed._plugins;
        var html;
        this._sourceShown = source;
        var self = this;
        try {
            if (!this.textArea) {
                this._createTextEditor();
            }
            if (source) {
                // Update the QueryCommandEnabled function to disable everything but
                // the source view mode.  Have to over-ride a function, then kick all
                // plugins to check their state.
                ed._sourceQueryCommandEnabled = ed.queryCommandEnabled;
                ed.queryCommandEnabled = function(cmd){
                    return cmd.toLowerCase() === "viewsourceadvanced";
                };
                this.editor.onDisplayChanged();
                html = ed.get("value");
                html = this._filter(html);
                ed.set("value", html);
                array.forEach(edPlugins, function(p) {
                    // Turn off any plugins not controlled by queryCommandenabled.
                    if (!(p instanceof ViewSourceAdvanced)) {
                        p.set("disabled", true)
                    }
                });

                // We actually do need to trap this plugin and adjust how we
                // display the textarea.
                if (this._fsPlugin) {
                    this._fsPlugin._getAltViewNode = function() {
                        return self.textArea;
                    };
                }

                ed.textEditor.set("value", html);
                domStyle.set(ed.iframe, "display", "none");
                domStyle.set(this.textArea, {
                    display: "block"
                });

                var resizer = function(){
                    // function to handle resize events.
                    // Will check current VP and only resize if
                    // different.
                    /***var vp = winUtils.getBox();

                    if ("_prevW" in this && "_prevH" in this) {
                        // No actual size change, ignore.
                        if (vp.w === this._prevW && vp.h === this._prevH) {
                            return;
                        }
                        else {
                            this._prevW = vp.w;
                            this._prevH = vp.h;
                        }
                    }
                    else {
                        this._prevW = vp.w;
                        this._prevH = vp.h;
                    }*/
                    if (this._resizer) {
                        clearTimeout(this._resizer);
                        delete this._resizer;
                    }
                    // Timeout it to help avoid spamming resize on IE.
                    // Works for all browsers.
                    this._resizer = setTimeout(lang.hitch(this, function() {
                        delete this._resizer;
                        this._resize();
                    }), 10);
                };
                this._resizeHandle = connect.connect(window, "onresize", this, resizer);

                //Call this on a delay once to deal with IE glitchiness on initial size.
                setTimeout(lang.hitch(this, this._resize), 100);

                //Trigger a check for command enablement/disablement.
                this.editor.onNormalizedDisplayChanged();

                this.editor.__oldGetValue = this.editor.getValue;
                this.editor.getValue = lang.hitch(this, function() {
                    return this._filter(ed.textEditor.get("value"));
                });
            }
            else {
                // First check that we were in source view before doing anything.
                // corner case for being called with a value of false and we hadn't
                // actually been in source display mode.
                if (!ed._sourceQueryCommandEnabled) {
                    return;
                }
                connect.disconnect(this._resizeHandle);
                delete this._resizeHandle;

                if (this.editor.__oldGetValue){
                    this.editor.getValue = this.editor.__oldGetValue;
                    delete this.editor.__oldGetValue;
                }

                // Restore all the plugin buttons state.
                ed.queryCommandEnabled = ed._sourceQueryCommandEnabled;
                
                if (!this.readOnly){
                    html = ed.textEditor.get("value");
                    html = this._filter(html);
                    ed.beginEditing();
                    ed.set("value", html);
                    ed.endEditing();
                }

                array.forEach(edPlugins, function(p){
                    // Turn back on any plugins we turned off.
                    p.set("disabled", false);
                });

                domStyle.set(this.textArea, "display", "none");
                domStyle.set(ed.iframe, "display", "block");
                delete ed._sourceQueryCommandEnabled;

                //Trigger a check for command enablement/disablement.
                this.editor.onDisplayChanged();
            }
            // Call a delayed resize to wait for some things to display in header/footer.
            setTimeout(lang.hitch(this, function() {
                // Make resize calls.
                var parent = ed.domNode.parentNode;
                if (parent){
                    var container = registry.getEnclosingWidget(parent);
                    if (container && container.resize) {
                        container.resize();
                    }
                }
                ed.resize();
            }), 300);
        }
        catch(e) {
            console.log(e);
        }
    },

    updateState: function() {
        // summary:
        //      Over-ride for button state control for disabled to work.
        this.button.set("disabled", this.get("disabled"));
    },

    _resize: function() {
        this.editor.textEditor.resize();
    },

    _createTextEditor: function() {
        // summary:
        //      Internal function for creating the source view area.
        // tags:
        //      private
        var ed = this.editor;
        var edPlugins = ed._plugins;

        var opts = {};
        if (this.mode) opts.mode = this.mode;
        if (this.theme) opts.theme = this.theme;
        var readOnly = ("readOnly" in ed) ? ed.readOnly : this.readOnly;
        if (readOnly) opts.readOnly = readOnly;
        ed.textEditor = new TextEditor(opts);

        this.textArea = ed.textEditor.domNode;
        // not sure what's up with this, is it caused by RichText?
        domStyle.set(this.textArea, {
            marginLeft: "-10px",
            marginRight: "-3px",
            marginTop: "-3px",
        });
        domConstruct.place(this.textArea, ed.iframe, "before");

        
        // We also need to take over editor focus a bit here, so that focus calls to
        // focus the editor will focus to the right node when VS is active.
        /***ed._viewsource_oldFocus = ed.focus;
        var self = this;
        ed.focus = function(){
            if(self._sourceShown){
                self.setTextAreaCursor();
            }else{
                try{
                    if(this._vsFocused){
                        delete this._vsFocused;
                        // Must focus edit node in this case (webkit only) or
                        // focus doesn't shift right, but in normal
                        // cases we focus with the regular function.
                        focus.focus(ed.editNode);
                    }else{
                        ed._viewsource_oldFocus();
                    }
                }catch(e){
                    console.log(e);
                }
            }
        };*/

        var i, p;
        for (i = 0; i < edPlugins.length; i++) {
            // We actually do need to trap this plugin and adjust how we
            // display the textarea.
            p = edPlugins[i];
            if (p && (p.declaredClass === "dijit._editor.plugins.FullScreen" ||
                    p.declaredClass === (dijit._scopeName +
                    "._editor.plugins.FullScreen"))) {
                this._fsPlugin = p;
                break;
            }
        }
        if (this._fsPlugin) {
            // Found, we need to over-ride the alt-view node function
            // on FullScreen with our own, chain up to parent call when appropriate.
            this._fsPlugin._viewsource_getAltViewNode = this._fsPlugin._getAltViewNode;
            this._fsPlugin._getAltViewNode = function() {
                return self._sourceShown?self.textArea:this._viewsource_getAltViewNode();
            };
        }

    },

    _stripScripts: function(html) {
        // summary:
        //      Strips out script tags from the HTML used in editor.
        // html: String
        //      The HTML to filter
        // tags:
        //      private
        if (html) {
            // Look for closed and unclosed (malformed) script attacks.
            html = html.replace(/<\s*script[^>]*>((.|\s)*?)<\\?\/\s*script\s*>/ig, "");
            html = html.replace(/<\s*script\b([^<>]|\s)*>?/ig, "");
            html = html.replace(/<[^>]*=(\s|)*[("|')]javascript:[^$1][(\s|.)]*[$1][^>]*>/ig, "");
        }
        return html;
    },

    _stripComments: function(html) {
        // summary:
        //      Strips out comments from the HTML used in editor.
        // html: String
        //      The HTML to filter
        // tags:
        //      private
        if (html) {
            html = html.replace(/<!--(.|\s){1,}?-->/g, "");
        }
        return html;
    },

    _stripIFrames: function(html) {
        // summary:
        //      Strips out iframe tags from the content, to avoid iframe script
        //      style injection attacks.
        // html: String
        //      The HTML to filter
        // tags:
        //      private
        if (html) {
            html = html.replace(/<\s*iframe[^>]*>((.|\s)*?)<\\?\/\s*iframe\s*>/ig, "");
        }
        return html;
    },

    _filter: function(html) {
        // summary:
        //      Internal function to perform some filtering on the HTML.
        // html: String
        //      The HTML to filter
        // tags:
        //      private
        if (html) {
            if(this.stripScripts) {
                html = this._stripScripts(html);
            }
            if (this.stripComments) {
                html = this._stripComments(html);
            }
            if (this.stripIFrames) {
                html = this._stripIFrames(html);
            }
        }
        return html;
    },

    setTextAreaCaret: function() {
        console.log('setcaret', arguments)
        // summary:
        //      Internal function to set the caret in the textArea
        //      to 0x0
        /***var global = win.global;
        var elem = this.textArea;
        focus.focus(elem);
        if(this._sourceShown && !this.readOnly){
            if(has("ie")){
                if(this.textArea.createTextRange){
                    var range = elem.createTextRange();
                    range.collapse(true);
                    range.moveStart("character", -99999); // move to 0
                    range.moveStart("character", 0); // delta from 0 is the correct position
                    range.moveEnd("character", 0);
                    range.select();
                }
            }else if(global.getSelection){
                if(elem.setSelectionRange){
                    elem.setSelectionRange(0,0);
                }
            }
        }*/
    },

    destroy: function() {
        if (this._resizer) {
            clearTimeout(this._resizer);
            delete this._resizer;
        }
        if (this._resizeHandle) {
            connect.disconnect(this._resizeHandle);
            delete this._resizeHandle;
        }
        delete this.editor.textEditor;
        delete this.textArea;
        this.inherited(arguments);
    }
});

// Register this plugin.
_Plugin.registry["viewSourceAdvanced"] = function(args) {
    var opts = {
        readOnly: ("readOnly" in args) ? args.readOnly : false,
        stripComments: ("stripComments" in args) ? args.stripComments:true,
        stripScripts: ("stripScripts" in args) ? args.stripScripts : true,
        stripIFrames: ("stripIFrames" in args) ? args.stripIFrames : true,
        init: ("init" in args) ? args.init : false
    };
    if (args.mode) opts.mode = args.mode;
    if (args.theme) opts.theme = args.theme;
    return new ViewSourceAdvanced(opts);
};

return ViewSourceAdvanced;

});
