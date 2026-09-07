<?php
/**
 * Plugin Name:       kui-player skin
 * Plugin URI:        https://github.com/kuraykaraaslan/kui-player
 * Description:       Puts the kui-player chrome on every <video> your site already renders — core blocks, embeds, page builders, whatever produced them. The media pipeline is untouched; only the controls change.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Kuray Karaaslan
 * Author URI:        https://kuray.dev
 * License:           Apache-2.0
 * License URI:       https://www.apache.org/licenses/LICENSE-2.0
 * Text Domain:       kui-player
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const KUI_PLAYER_VERSION = '0.1.0';

/**
 * Where the bundle comes from. Point this at a local copy with the
 * `kui_player_script_url` filter if you would rather not use a CDN — the plugin
 * makes no other network request, and neither does the player.
 */
function kui_player_script_url() {
	$default = sprintf(
		'https://cdn.jsdelivr.net/npm/@kuraykaraaslan/kui-player@%s/dist/embed.js',
		KUI_PLAYER_VERSION
	);

	return apply_filters( 'kui_player_script_url', $default );
}

/**
 * Settings, all filterable so a theme can override them without a settings screen.
 *
 * selector   CSS selector for the videos to skin. 'video' means all of them.
 * accent     Any CSS colour; becomes --kui-accent.
 * autohide   Hide the controls after inactivity while playing.
 * keyboard   Keyboard shortcuts while the pointer is over the player.
 * cast       Show the Google Cast button. Off by default: turning it on loads
 *            Google's sender SDK from gstatic.com, which is the only external
 *            request the player can make.
 */
function kui_player_settings() {
	return apply_filters(
		'kui_player_settings',
		array(
			'selector' => 'video',
			'accent'   => '',
			'autohide' => true,
			'keyboard' => true,
			'cast'     => false,
		)
	);
}

function kui_player_enqueue() {
	if ( is_admin() ) {
		return;
	}

	wp_enqueue_script(
		'kui-player',
		kui_player_script_url(),
		array(),
		KUI_PLAYER_VERSION,
		true
	);
}
add_action( 'wp_enqueue_scripts', 'kui_player_enqueue' );

/**
 * The bundle configures itself from the data attributes on its own script tag,
 * so the whole integration is this filter.
 */
function kui_player_script_attributes( $tag, $handle ) {
	if ( 'kui-player' !== $handle ) {
		return $tag;
	}

	$settings = kui_player_settings();
	$attrs    = sprintf( ' data-auto="%s"', esc_attr( $settings['selector'] ) );

	if ( ! empty( $settings['accent'] ) ) {
		$attrs .= sprintf( ' data-accent="%s"', esc_attr( $settings['accent'] ) );
	}
	if ( empty( $settings['autohide'] ) ) {
		$attrs .= ' data-autohide="false"';
	}
	if ( empty( $settings['keyboard'] ) ) {
		$attrs .= ' data-keyboard="false"';
	}
	if ( ! empty( $settings['cast'] ) ) {
		$attrs .= ' data-cast="true"';
	}

	return str_replace( ' src=', $attrs . ' src=', $tag );
}
add_filter( 'script_loader_tag', 'kui_player_script_attributes', 10, 2 );
