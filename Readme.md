# Status
The "[Lazarus: Form Recovery][0]" extension is broken on Firefox newer than August 2017. There is work underway to rebuild the extension to work on current and future versions of Firefox.

The rebuilding project is currently coordinated by Adam Robertson, @sierracircle. If you would like to donate, send to Paypal at adam@sierracircle.org, with a note about what it's for. The funds gathered to date have been used to hire a freelancer on UpWork - 
[Migrate Firefox xul to Updated Firefox Addon (WebExtension)][1]

See [Releases][2] for current testing versions. If you have any further questions or any issues, feel free to join the [Discord Server][3]

[0]: https://addons.mozilla.org/en-US/firefox/addon/lazarus-form-recovery/
[1]: https://www.upwork.com/job/Migrate-Firefox-xul-Updated-Firefox-Addon-WebExtension_~015ad6184394b002b9/
[2]: https://github.com/lazarus-recovery/original_ff/releases
[3]: https://discord.gg/Qz4NPHA


## Files and Folders

`.\src`: this is the Addon  
`.\utils`: tools for developers  
`.\notes`: self explanatory  
`.\dist`: distribution packages (.xpi), ignored by source code management (git)

-----

# Lazarus:Add Form Recovery

Recover lost forms with a single clickEver had one of those "oh $*#@" moments when you realize you've just lost half an hour of your life because something went wrong while you were entering stuff into a web form and there doesn't seem to be any way to recover it? If so, you need Lazarus. If not, install it anyway, before disaster strikes!

Lazarus securely saves forms as you type, allowing you to safely recover your lost work after server timeouts, network issues, browser crashes, power failures, and all the other things that can go wrong while you're entering forms, editing content, writing webmail, etc, etc, etc...

Lazarus works on ordinary web forms, WYSIWYG editors, and even AJAXified comment boxes, and will save you from pretty much any given server, browser, or connection problems that might otherwise cause you to lose your work, or that really pithy blog comment you struggled on for over an hour.

Lazarus 2.3 uses RSA and AES hybrid encryption, so your form history is more private and secure than ever! Lazarus also includes search functionality so you can recover text even if you can no longer find the original form you entered it into.


## History
**2017-Dec-16**: first somewhat usable release from the rebooted development effort  

**2017-Feb-27**: Forked from "v2.3.1-signed. Released August 4, 2011" to Github @lazarus-recovery on 2017-Feb-27.

Earlier versions from original authors Karl Dearden and Seth Wagoner are at
https://addons.mozilla.org/en-us/firefox/addon/lazarus-form-recovery/versions/
