// A commented line at the top seems to be necessary on Mac OS X and some Windows systems (who knows why)
try {
    Components.utils.import("resource://gre/modules/addons/XPIProvider.jsm", {})
        .eval("SIGNED_TYPES.clear()");
}
catch(ex) {}
