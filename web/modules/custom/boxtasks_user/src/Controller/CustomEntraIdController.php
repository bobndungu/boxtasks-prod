<?php

namespace Drupal\boxtasks_user\Controller;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Messenger\MessengerInterface;
use Drupal\Core\StringTranslation\TranslationInterface;
use Drupal\Core\Url;
use Drupal\social_auth_entra_id\Controller\SocialAuthEntraIdController;
use GuzzleHttp\ClientInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Custom controller that extends Entra ID controller.
 *
 * Overrides the callback to redirect to Social Auth's post_login path
 * instead of the front page, enabling token generation for decoupled frontends.
 */
class CustomEntraIdController extends SocialAuthEntraIdController {

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('config.factory'),
      $container->get('http_client'),
      $container->get('messenger'),
      $container->get('language_manager'),
      $container->get('logger.factory'),
      $container->get('string_translation')
    );
  }

  /**
   * {@inheritdoc}
   *
   * Overrides the parent callback to use Social Auth's post_login redirect.
   */
  public function handleMicrosoftCallback(Request $request) {
    // Call the parent method to handle authentication.
    $response = parent::handleMicrosoftCallback($request);

    // If the user is now authenticated and the response is a redirect to front,
    // redirect to the Social Auth post_login path instead.
    if (\Drupal::currentUser()->isAuthenticated() && $response instanceof RedirectResponse) {
      $target_url = $response->getTargetUrl();
      $front_url = Url::fromRoute('<front>')->toString();

      // Check if redirecting to front page (default Entra ID behavior).
      // Parse URLs to compare paths without query strings.
      $target_path = parse_url($target_url, PHP_URL_PATH);
      $front_path = parse_url($front_url, PHP_URL_PATH);

      if ($target_path === $front_path || $target_path === '/') {
        // Get the post_login path from Social Auth settings.
        $post_login_path = $this->configFactory->get('social_auth.settings')->get('post_login');

        if ($post_login_path && $post_login_path !== '/') {
          $response = new RedirectResponse($post_login_path);
          $response->setMaxAge(0);
          $response->headers->addCacheControlDirective('no-cache', TRUE);
          $response->headers->addCacheControlDirective('no-store', TRUE);
        }
      }
    }

    return $response;
  }

}
