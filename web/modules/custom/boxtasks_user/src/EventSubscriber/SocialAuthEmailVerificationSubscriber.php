<?php

namespace Drupal\boxtasks_user\EventSubscriber;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Messenger\MessengerInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\social_auth\Event\LoginEvent;
use Drupal\social_auth\Event\SocialAuthEvents;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Drupal\Core\Routing\TrustedRedirectResponse;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\HttpKernel\Event\ResponseEvent;

/**
 * Verifies that OAuth email matches the Drupal user email on login.
 *
 * If a user logs in with Google/Microsoft and the OAuth email doesn't match
 * the Drupal user's email, log them out and ask them to register.
 */
class SocialAuthEmailVerificationSubscriber implements EventSubscriberInterface {

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected EntityTypeManagerInterface $entityTypeManager;

  /**
   * The current user.
   *
   * @var \Drupal\Core\Session\AccountProxyInterface
   */
  protected AccountProxyInterface $currentUser;

  /**
   * The messenger service.
   *
   * @var \Drupal\Core\Messenger\MessengerInterface
   */
  protected MessengerInterface $messenger;

  /**
   * The logger factory.
   *
   * @var \Drupal\Core\Logger\LoggerChannelFactoryInterface
   */
  protected LoggerChannelFactoryInterface $loggerFactory;

  /**
   * Flag to track if email mismatch was detected.
   *
   * @var bool
   */
  protected bool $emailMismatchDetected = FALSE;

  /**
   * Constructs a SocialAuthEmailVerificationSubscriber.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Drupal\Core\Session\AccountProxyInterface $current_user
   *   The current user.
   * @param \Drupal\Core\Messenger\MessengerInterface $messenger
   *   The messenger service.
   * @param \Drupal\Core\Logger\LoggerChannelFactoryInterface $logger_factory
   *   The logger factory.
   */
  public function __construct(
    EntityTypeManagerInterface $entity_type_manager,
    AccountProxyInterface $current_user,
    MessengerInterface $messenger,
    LoggerChannelFactoryInterface $logger_factory,
  ) {
    $this->entityTypeManager = $entity_type_manager;
    $this->currentUser = $current_user;
    $this->messenger = $messenger;
    $this->loggerFactory = $logger_factory;
  }

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    return [
      SocialAuthEvents::USER_LOGIN => ['onSocialAuthLogin', 100],
      KernelEvents::RESPONSE => ['onResponse', -100],
    ];
  }

  /**
   * Handles the social auth login event.
   *
   * @param \Drupal\social_auth\Event\LoginEvent $event
   *   The login event.
   */
  public function onSocialAuthLogin(LoginEvent $event): void {
    $drupal_account = $event->getDrupalAccount();
    $social_auth_user = $event->getSocialAuthUser();
    $plugin_id = $event->getPluginId();

    // Get the OAuth email.
    $oauth_email = $social_auth_user->getEmail();
    if (empty($oauth_email)) {
      // If no email from OAuth, we can't verify - allow the login.
      return;
    }

    // Load the full user entity to get the email.
    $user = $this->entityTypeManager->getStorage('user')->load($drupal_account->id());
    if (!$user) {
      return;
    }

    $drupal_email = $user->getEmail();

    // Compare emails (case-insensitive).
    if (strtolower($oauth_email) !== strtolower($drupal_email)) {
      // Email mismatch detected!
      $this->loggerFactory->get('boxtasks_user')->warning(
        'OAuth email mismatch: OAuth email "@oauth_email" does not match Drupal user "@drupal_email" (uid: @uid, provider: @provider). User logged out.',
        [
          '@oauth_email' => $oauth_email,
          '@drupal_email' => $drupal_email,
          '@uid' => $drupal_account->id(),
          '@provider' => $plugin_id,
        ]
      );

      // Log the user out.
      user_logout();

      // Set a message for the user.
      $this->messenger->addError(t(
        'The email address "@oauth_email" is not associated with any account. Please register a new account or sign in with the correct email address.',
        ['@oauth_email' => $oauth_email]
      ));

      // Flag for response redirect.
      $this->emailMismatchDetected = TRUE;
    }
  }

  /**
   * Handles the kernel response event to redirect on email mismatch.
   *
   * @param \Symfony\Component\HttpKernel\Event\ResponseEvent $event
   *   The response event.
   */
  public function onResponse(ResponseEvent $event): void {
    if ($this->emailMismatchDetected) {
      $frontend_url = getenv('FRONTEND_URL') ?: 'https://tasks.boxraft.com';
      $event->setResponse(new TrustedRedirectResponse($frontend_url . '/register?error=email_mismatch'));
      $this->emailMismatchDetected = FALSE;
    }
  }

}
