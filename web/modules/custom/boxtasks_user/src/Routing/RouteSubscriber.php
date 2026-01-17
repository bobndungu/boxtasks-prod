<?php

namespace Drupal\boxtasks_user\Routing;

use Drupal\Core\Routing\RouteSubscriberBase;
use Symfony\Component\Routing\RouteCollection;

/**
 * Listens to route events and overrides routes.
 */
class RouteSubscriber extends RouteSubscriberBase {

  /**
   * {@inheritdoc}
   */
  protected function alterRoutes(RouteCollection $collection) {
    // Override the Entra ID callback route to use our custom controller.
    if ($route = $collection->get('social_auth_entra_id.callback')) {
      $route->setDefault('_controller', '\Drupal\boxtasks_user\Controller\CustomEntraIdController::handleMicrosoftCallback');
    }
  }

}
