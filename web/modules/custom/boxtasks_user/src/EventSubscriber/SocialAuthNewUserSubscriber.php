<?php

namespace Drupal\boxtasks_user\EventSubscriber;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\social_auth\Event\UserEvent;
use Drupal\social_auth\Event\SocialAuthEvents;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Handles new user creation via social auth.
 *
 * New users created via Google/Microsoft OAuth are blocked by default
 * and require manual admin approval before they can log in.
 *
 * The actual redirect to the pending approval page is handled by
 * SocialAuthTokenController when it detects the user is blocked.
 */
class SocialAuthNewUserSubscriber implements EventSubscriberInterface {

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected EntityTypeManagerInterface $entityTypeManager;

  /**
   * The logger factory.
   *
   * @var \Drupal\Core\Logger\LoggerChannelFactoryInterface
   */
  protected LoggerChannelFactoryInterface $loggerFactory;

  /**
   * Constructs a SocialAuthNewUserSubscriber.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Drupal\Core\Logger\LoggerChannelFactoryInterface $logger_factory
   *   The logger factory.
   */
  public function __construct(
    EntityTypeManagerInterface $entity_type_manager,
    LoggerChannelFactoryInterface $logger_factory,
  ) {
    $this->entityTypeManager = $entity_type_manager;
    $this->loggerFactory = $logger_factory;
  }

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    return [
      SocialAuthEvents::USER_CREATED => ['onUserCreated', 100],
    ];
  }

  /**
   * Handles the social auth user created event.
   *
   * Blocks newly created users so they require admin approval.
   * The redirect to the pending page is handled by SocialAuthTokenController.
   *
   * @param \Drupal\social_auth\Event\UserEvent $event
   *   The user event.
   */
  public function onUserCreated(UserEvent $event): void {
    $drupal_account = $event->getDrupalAccount();
    $social_auth_user = $event->getSocialAuthUser();
    $plugin_id = $event->getPluginId();

    // Load the full user entity.
    $user = $this->entityTypeManager->getStorage('user')->load($drupal_account->id());
    if (!$user) {
      return;
    }

    // Get the email for logging.
    $email = $social_auth_user->getEmail() ?: $user->getEmail();

    // Block the user - they need admin approval.
    $user->block();
    $user->save();

    $this->loggerFactory->get('boxtasks_user')->info(
      'New user created via @provider with email "@email" (uid: @uid). User is blocked pending admin approval.',
      [
        '@provider' => $plugin_id,
        '@email' => $email,
        '@uid' => $drupal_account->id(),
      ]
    );

    // Note: We don't log the user out here or redirect.
    // The social auth flow will continue to SocialAuthTokenController,
    // which will detect the user is blocked and handle the redirect.
  }

}
