<?php

namespace Drupal\social_auth_microsoft\Plugin\Network;

use Drupal\social_auth\Plugin\Network\NetworkBase;

/**
 * Defines a Network Plugin for Social Auth Microsoft.
 *
 * @package Drupal\social_auth_microsoft\Plugin\Network
 *
 * @Network(
 *   id = "social_auth_microsoft",
 *   short_name = "microsoft",
 *   social_network = "Microsoft",
 *   img_path = "img/microsoft_logo.svg",
 *   type = "social_auth",
 *   class_name = "\Stevenmaguire\OAuth2\Client\Provider\Microsoft",
 *   auth_manager = "\Drupal\social_auth_microsoft\MicrosoftAuthManager",
 *   routes = {
 *     "redirect": "social_auth.network.redirect",
 *     "callback": "social_auth.network.callback",
 *     "settings_form": "social_auth.network.settings_form",
 *    },
 *   handlers = {
 *     "settings": {
 *       "class": "\Drupal\social_auth\Settings\SettingsBase",
 *       "config_id": "social_auth_microsoft.settings"
 *     }
 *   }
 * )
 */
class MicrosoftAuth extends NetworkBase {}
