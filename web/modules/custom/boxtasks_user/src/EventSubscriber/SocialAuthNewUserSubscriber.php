<?php

namespace Drupal\boxtasks_user\EventSubscriber;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Messenger\MessengerInterface;
use Drupal\social_auth\Event\UserEvent;
use Drupal\social_auth\Event\SocialAuthEvents;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\HttpKernel\Event\ResponseEvent;

/**
 * Handles new user creation via social auth.
 *
 * New users created via Google/Microsoft OAuth are blocked by default
 * and require manual admin approval before they can log in.
 */
class SocialAuthNewUserSubscriber implements EventSubscriberInterface {

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected EntityTypeManagerInterface $entityTypeManager;

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
   * Flag to track if new user was created and blocked.
   *
   * @var bool
   */
  protected bool $newUserBlocked = FALSE;

  /**
   * The email of the new user.
   *
   * @var string|null
   */
  protected ?string $newUserEmail = NULL;

  /**
   * Constructs a SocialAuthNewUserSubscriber.
   *
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Drupal\Core\Messenger\MessengerInterface $messenger
   *   The messenger service.
   * @param \Drupal\Core\Logger\LoggerChannelFactoryInterface $logger_factory
   *   The logger factory.
   */
  public function __construct(
    EntityTypeManagerInterface $entity_type_manager,
    MessengerInterface $messenger,
    LoggerChannelFactoryInterface $logger_factory,
  ) {
    $this->entityTypeManager = $entity_type_manager;
    $this->messenger = $messenger;
    $this->loggerFactory = $logger_factory;
  }

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    return [
      SocialAuthEvents::USER_CREATED => ['onUserCreated', 100],
      KernelEvents::RESPONSE => ['onResponse', -90],
    ];
  }

  /**
   * Handles the social auth user created event.
   *
   * Blocks newly created users so they require admin approval.
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
    $this->newUserEmail = $email;

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

    // Log the user out since they're now blocked.
    user_logout();

    // Set a message for the user.
    $this->messenger->addStatus(t(
      'Your account has been created and is pending approval. An administrator will review your request and you will be notified when your account is approved.'
    ));

    // Flag for response redirect.
    $this->newUserBlocked = TRUE;
  }

  /**
   * Handles the kernel response event to redirect on new blocked user.
   *
   * @param \Symfony\Component\HttpKernel\Event\ResponseEvent $event
   *   The response event.
   */
  public function onResponse(ResponseEvent $event): void {
    if ($this->newUserBlocked) {
      $frontend_url = getenv('FRONTEND_URL') ?: 'https://tasks.boxraft.com';
      $redirect_url = $frontend_url . '/register?pending=true';
      if ($this->newUserEmail) {
        $redirect_url .= '&email=' . urlencode($this->newUserEmail);
      }
      $event->setResponse(new RedirectResponse($redirect_url));
      $this->newUserBlocked = FALSE;
      $this->newUserEmail = NULL;
    }
  }

}
