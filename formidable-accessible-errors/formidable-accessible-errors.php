<?php
/**
 * Plugin Name: Formidable - Accessible Error Summary
 * Description: Accessible error summary for Formidable Forms: focuses the summary, and links each error to the field. Disables default first-error focus & per-field alert roles.
 * Version:     1.2.0
 * Author:      Adem Cifcioglu
 * License:     GPL-2.0+
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

class FF_Accessible_Error_Summary {
	private static $errors            = [];
	private static $form_id           = 0;
	private static $assets_registered = false;
	private static $assets_enqueued   = false;
	private static $load_css          = false;

	public static function init() {
		// Capture errors and remember the current form id.
		add_filter( 'frm_validate_entry', [ __CLASS__, 'capture_errors' ], 20, 2 );

		// Replace the invalid error message block with an accessible summary.
		add_filter( 'frm_invalid_error_message', [ __CLASS__, 'render_error_summary' ], 10, 2 );

		// Our JS for focusing summary + jumping to fields. Register early; enqueue when a form renders.
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'register_assets' ] );
		add_action( 'frm_enqueue_form_scripts', [ __CLASS__, 'maybe_enqueue_assets' ], 10, 1 );

		// Disable Formidable's default behaviours that interfere with our UX.
		add_filter( 'frm_focus_first_error', '__return_false' );
		add_filter( 'frm_include_alert_role_on_field_errors', '__return_false' );
	}

	public static function capture_errors( $errors, $values ) {
		self::$errors  = is_array( $errors ) ? $errors : [];
		// Formidable includes form_id in $values on validation.
		if ( ! empty( $values['form_id'] ) ) {
			self::$form_id = absint( $values['form_id'] );
		}
		return $errors;
	}

	public static function render_error_summary( $invalid_msg, $args ) {
		$errors  = self::$errors;
		$form_id = self::$form_id;

		if ( empty( $errors ) || ! is_array( $errors ) ) {
			return esc_html__( 'There was a problem with your submission. Errors are marked below.', 'ff-accessible-errors' );
		}

		// If args contains a form object, prefer that id.
		if ( isset( $args['form']->id ) && $args['form']->id ) {
			$form_id = absint( $args['form']->id );
		}

		// Build a lookup of field identifiers -> numeric field IDs for this form.
		$field_map = self::build_field_map( $form_id );

		$heading_id = 'ff-error-heading-' . (int) $form_id;
		$out  = '<div class="ff-global-errors" aria-labelledby="' . esc_attr( $heading_id ) . '" tabindex="-1">';
		$out .= '<h2 id="' . esc_attr( $heading_id ) . '"><span class="ff-error-icon" aria-hidden="true"></span>' .
		        esc_html__( 'There were the following problems with your submission:', 'ff-accessible-errors' ) .
		        '</h2>';
		$out .= '<ol class="ff-error-list">';

		foreach ( $errors as $key => $message ) {
			$msg = is_array( $message ) ? implode( ' ', $message ) : (string) $message;
			$msg = trim( $msg );

			$field_id = self::resolve_field_id( $key, $field_map );
			if ( ! empty( $msg ) ) {
				if ( $field_id ) {
					$container_id = 'frm_field_' . $field_id . '_container';
					$out         .= '<li class="ff-error-item"><a class="ff-error-link" href="#' . esc_attr( $container_id ) . '" data-ff-field-id="' . esc_attr( $field_id ) . '">' . esc_html( $msg ) . '</a></li>';
				} else {
					// Non-field/global errors.
					$out .= '<li class="ff-error-item">' . esc_html( $msg ) . '</li>';
				}
			}
		}

		$out .= '</ol></div>';
		return $out;
	}

	/**
	 * Create flexible mappings for the current form:
	 *  - by_id[123] = 123
	 *  - by_prefixed["field123"] = 123
	 *  - by_key["email_address"] = 456   (field key/slug)
	 */
	private static function build_field_map( $form_id ) {
		$map = [ 'by_id' => [], 'by_prefixed' => [], 'by_key' => [] ];

		if ( ! class_exists( 'FrmField' ) || ! $form_id ) {
			return $map;
		}

		$fields = \FrmField::get_all_for_form( $form_id, '', 'include' );
		foreach ( (array) $fields as $f ) {
			$id  = isset( $f->id ) ? (int) $f->id : 0;
			$key = isset( $f->field_key ) ? (string) $f->field_key : '';
			if ( $id ) {
				$map['by_id'][ $id ]       = $id;
				$map['by_prefixed'][ 'field' . $id ]     = $id;         // handles "field123"
				$map['by_prefixed'][ 'frm_field_' . $id ] = $id;     // extra safety
			}
			if ( $key ) {
				$map['by_key'][ $key ] = $id;
			}
		}
		return $map;
	}

	/**
	 * Resolve a field id from a variety of error keys:
	 * - 123                    -> 123
	 * - "field123"             -> 123
	 * - "frm_field_123"        -> 123
	 * - "{field_key/slug}"     -> id
	 * - Anything else          -> null (global error)
	 */
	private static function resolve_field_id( $error_key, $map ) {
		// Numeric key straight to id.
		if ( is_numeric( $error_key ) ) {
			$id = (int) $error_key;
			return $map['by_id'][ $id ] ?? $id;
		}

		$key = (string) $error_key;

		// Exact key match first (field key / slug).
		if ( isset( $map['by_key'][ $key ] ) ) {
			return (int) $map['by_key'][ $key ];
		}

		// Common prefixes.
		if ( isset( $map['by_prefixed'][ $key ] ) ) {
			return (int) $map['by_prefixed'][ $key ];
		}

		// Fallback: extract trailing digits (handles "field123", "x_123").
		if ( preg_match( '/(\d{1,})$/', $key, $m ) ) {
			$id = (int) $m[1];
			if ( isset( $map['by_id'][ $id ] ) ) {
				return $id;
			}
		}

		return null;
	}

	public static function register_assets() {
		if ( self::$assets_registered ) {
			return;
		}

		self::$assets_registered = true;

		wp_register_script(
			'ff-accessible-errors',
			plugins_url( 'assets/js/ff-accessible-errors.js', __FILE__ ),
			[ 'jquery' ],
			'1.2.0',
			true
		);

		/*
		* // Turn OFF the inline icon <span>
		* add_filter('ff_accessible_errors_inline_icon_enabled', '__return_false');
		* // Change the ARIA label
		* add_filter('ff_accessible_errors_inline_icon_aria_label', function () {
		* return 'Error message:';
		* });
		*/

		// Options for JS (toggle & aria label)
		$inline_icon_enabled = apply_filters( 'ff_accessible_errors_inline_icon_enabled', true );
		$inline_icon_label   = apply_filters( 'ff_accessible_errors_inline_icon_aria_label', __( 'Error:', 'ff-accessible-errors' ) );

		wp_localize_script(
			'ff-accessible-errors',
			'FFAE',
			[
				'inlineIconEnabled'   => (bool) $inline_icon_enabled,
				'inlineIconAriaLabel' => (string) $inline_icon_label,
			]
		);

		// CSS (allow disable via filter)
		// To disable, use - add_filter('ff_accessible_errors_load_css', '__return_false');
		$load_css       = apply_filters( 'ff_accessible_errors_load_css', true );
		self::$load_css = (bool) $load_css;
		if ( self::$load_css ) {
			wp_register_style(
				'ff-accessible-errors',
				plugins_url( 'assets/css/ff-accessible-errors.css', __FILE__ ),
				[],
				'1.2.0'
			);
		}
	}

	public static function maybe_enqueue_assets( $params = null ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter
		if ( self::$assets_enqueued ) {
			return;
		}

		if ( ! self::$assets_registered ) {
			self::register_assets();
		}

		wp_enqueue_script( 'ff-accessible-errors' );

		if ( self::$load_css ) {
			wp_enqueue_style( 'ff-accessible-errors' );
		}

		self::$assets_enqueued = true;
	}
}
FF_Accessible_Error_Summary::init();
