# WordPress

The plugin in [`wordpress/kui-player`](../wordpress/kui-player) skins every `<video>`
your site already renders — core video blocks, page builders, any plugin that outputs a
video tag.

## Install

Copy the `wordpress/kui-player` directory into `wp-content/plugins/` and activate it.
There is no settings screen: everything is a filter, so configuration lives in your
theme and travels with your code.

```php
add_filter( 'kui_player_settings', function ( $settings ) {
	$settings['selector'] = '.wp-block-video video';
	$settings['accent']   = '#f97316';
	$settings['cast']     = true;   // loads Google's Cast SDK; off by default
	return $settings;
} );
```

## Serving the bundle yourself

By default the plugin loads the versioned bundle from jsDelivr. To host it:

```php
add_filter( 'kui_player_script_url', function () {
	return get_stylesheet_directory_uri() . '/js/kui-player-embed.js';
} );
```

Copy `dist/embed.js` from the package into that path. The player makes no other request.
