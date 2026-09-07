=== kui-player skin ===
Contributors: kuraykaraaslan
Tags: video, player, video controls, accessibility, chromecast
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 0.1.0
License: Apache-2.0
License URI: https://www.apache.org/licenses/LICENSE-2.0

Replaces the browser's video controls with an accessible, themeable player chrome — without touching how your videos are delivered.

== Description ==

This plugin does one thing: it puts the kui-player chrome on every `<video>` your
site already renders. It does not replace your video hosting, your embeds, or the
way media is delivered. The element keeps its own source and pipeline; only the
controls change.

That means it works with core video blocks, page builders, and any plugin that
outputs a `<video>` tag, including ones backed by HLS through hls.js.

* Keyboard operable, screen-reader announced, WCAG AA contrast
* Touch gestures on phones: double-tap to skip, hold for 2×, drag to scrub
* Picture-in-Picture, fullscreen that works on iOS, subtitle rendering
* About 30 KB gzipped, loaded from a CDN or from your own server
* **No telemetry and no external requests.** Google Cast is off by default,
  because turning it on loads Google's sender SDK from gstatic.com.

== Configuration ==

There is no settings screen — everything is a filter, so it belongs in your
theme's `functions.php` and travels with your code:

`add_filter( 'kui_player_settings', function ( $settings ) {
	$settings['selector'] = '.wp-block-video video';
	$settings['accent']   = '#f97316';
	$settings['cast']     = true;
	return $settings;
} );`

To serve the bundle yourself instead of from the CDN:

`add_filter( 'kui_player_script_url', function () {
	return get_stylesheet_directory_uri() . '/js/kui-player-embed.js';
} );`

== Frequently Asked Questions ==

= Does this change how my videos are hosted or encoded? =

No. It adopts the `<video>` element that is already on the page.

= Will it fight with my existing player plugin? =

Point `selector` at only the videos you want skinned. Anything else is left alone.

= Does it phone home? =

No. The player makes no request other than the media you point it at. Cast is the
one exception and it is off by default.

== Changelog ==

= 0.1.0 =
* First release.
