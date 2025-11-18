<?php
/**
 * Plugin Name: Formidable Dropzone A11y Enhancements
 * Description: Accessibility fixes for Formidable Forms Dropzone upload fields — focus management, "Other" labels, and upload announcements.
 * Version: 1.0.3
 * Author: Adem Cifcioglu
 * License: GPL-2.0+
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Formidable_Dropzone_A11y_Enhancements {

	/**
	 * @var bool
	 */
	private $assets_registered = false;

	/**
	 * @var bool
	 */
	private $assets_enqueued = false;

	public function __construct() {
		add_action( 'wp_enqueue_scripts', [ $this, 'register_assets' ] );
		add_action( 'wp_footer', [ $this, 'conditionally_enqueue_assets' ], 15 );
	}

	/**
	 * Register scripts/styles so they can be enqueued later when needed.
	 *
	 * @return void
	 */
	public function register_assets() {
		if ( $this->assets_registered ) {
			return;
		}

		$ver = '1.0.3';

		wp_register_style(
			'formidable-dropzone-a11y-enhancements',
			plugins_url( 'assets/formidable-dropzone-a11y-enhancements.css', __FILE__ ),
			[],
			$ver
		);

		wp_register_script(
			'formidable-dropzone-a11y-enhancements',
			plugins_url( 'assets/formidable-dropzone-a11y-enhancements.js', __FILE__ ),
			[ 'jquery' ],
			$ver,
			true
		);

		$this->assets_registered = true;
	}

	/**
	 * After Formidable has processed the page, enqueue assets only if a Dropzone field exists.
	 *
	 * @return void
	 */
	public function conditionally_enqueue_assets() {
		if ( $this->assets_enqueued || is_admin() ) {
			return;
		}

		$force = apply_filters( 'formidable_dropzone_a11y_force_enqueue', false );

		$has_dropzone = (bool) $force;

		if ( ! $has_dropzone ) {
			global $frm_vars;
			$has_dropzone = ! empty( $frm_vars['dropzone_loaded'] );
		}

		if ( ! $has_dropzone ) {
			return;
		}

		$this->enqueue_assets();
	}

	/**
	 * Enqueue the CSS/JS handles and print late styles if needed.
	 *
	 * @return void
	 */
	private function enqueue_assets() {
		if ( ! $this->assets_registered ) {
			$this->register_assets();
		}

		wp_enqueue_style( 'formidable-dropzone-a11y-enhancements' );
		wp_enqueue_script( 'formidable-dropzone-a11y-enhancements' );
		$this->assets_enqueued = true;

		// wp_print_styles already ran in the head, so print our stylesheet now if necessary.
		if ( did_action( 'wp_print_styles' ) ) {
			wp_print_styles( 'formidable-dropzone-a11y-enhancements' );
		}
	}
}

new Formidable_Dropzone_A11y_Enhancements();
