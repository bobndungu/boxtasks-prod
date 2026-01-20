<?php

declare(strict_types=1);

namespace Drupal\boxtasks_notification;

use Drupal\user\UserInterface;
use Drupal\node\NodeInterface;

/**
 * Service for generating rich HTML email templates.
 */
class EmailTemplateService {

  /**
   * The BoxTasks brand colors.
   */
  protected const BRAND_PRIMARY = '#3B82F6';
  protected const BRAND_PRIMARY_DARK = '#2563EB';
  protected const BRAND_SUCCESS = '#10B981';
  protected const BRAND_WARNING = '#F59E0B';
  protected const BRAND_DANGER = '#EF4444';

  /**
   * Get the frontend URL from configuration or request.
   *
   * @return string
   *   The frontend URL.
   */
  protected function getFrontendUrl(): string {
    $frontend_url = \Drupal::config('boxtasks_notification.settings')->get('frontend_url');
    if ($frontend_url) {
      return rtrim($frontend_url, '/');
    }
    return rtrim(\Drupal::request()->getSchemeAndHttpHost(), '/');
  }

  /**
   * Get the user's display name (full name or username).
   *
   * @param \Drupal\user\UserInterface $user
   *   The user entity.
   *
   * @return string
   *   The display name.
   */
  protected function getUserDisplayName(UserInterface $user): string {
    if ($user->hasField('field_display_name') && !$user->get('field_display_name')->isEmpty()) {
      return $user->get('field_display_name')->value;
    }
    return $user->getDisplayName();
  }

  /**
   * Get the user's first name from display name.
   *
   * @param \Drupal\user\UserInterface $user
   *   The user entity.
   *
   * @return string
   *   The first name or full display name.
   */
  protected function getUserFirstName(UserInterface $user): string {
    $display_name = $this->getUserDisplayName($user);
    $parts = explode(' ', $display_name);
    return $parts[0];
  }

  /**
   * Builds the base email template wrapper.
   *
   * @param string $content
   *   The main content HTML.
   * @param string $preheader
   *   The preheader text (preview text in email clients).
   *
   * @return string
   *   The complete HTML email.
   */
  protected function buildBaseTemplate(string $content, string $preheader = ''): string {
    $frontend_url = $this->getFrontendUrl();
    $year = date('Y');

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>BoxTasks Notification</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    @media only screen and (max-width: 620px) {
      .wrapper { width: 100% !important; max-width: 100% !important; }
      .responsive-table { width: 100% !important; }
      .padding { padding: 10px 5% 15px 5% !important; }
      .section-padding { padding: 0 15px 50px 15px !important; }
    }
    .button-td, .button-a {
      transition: all 100ms ease-in;
    }
    .button-td:hover, .button-a:hover {
      background: #2563EB !important;
      border-color: #2563EB !important;
    }
  </style>
</head>
<body style="margin: 0 !important; padding: 0 !important; background-color: #f4f4f5;">
  <!-- Preheader text (hidden but shows in email preview) -->
  <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    {$preheader}
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="wrapper" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 30px 20px;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; color: #ffffff; letter-spacing: -0.5px;">
                      BoxTasks
                    </h1>
                    <p style="margin: 5px 0 0 0; font-family: Arial, sans-serif; font-size: 14px; color: rgba(255,255,255,0.8);">
                      Task Management Made Simple
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;" class="padding">
              {$content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; border-top: 1px solid #e5e7eb;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 15px;">
                    <a href="{$frontend_url}/dashboard" style="color: #6b7280; text-decoration: none; font-family: Arial, sans-serif; font-size: 13px; margin: 0 10px;">Dashboard</a>
                    <span style="color: #d1d5db;">|</span>
                    <a href="{$frontend_url}/profile" style="color: #6b7280; text-decoration: none; font-family: Arial, sans-serif; font-size: 13px; margin: 0 10px;">Settings</a>
                    <span style="color: #d1d5db;">|</span>
                    <a href="{$frontend_url}/notifications" style="color: #6b7280; text-decoration: none; font-family: Arial, sans-serif; font-size: 13px; margin: 0 10px;">Notifications</a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #9ca3af;">
                      You received this email because of your notification preferences.
                    </p>
                    <p style="margin: 5px 0 0 0; font-family: Arial, sans-serif; font-size: 12px; color: #9ca3af;">
                      <a href="{$frontend_url}/profile" style="color: #3B82F6; text-decoration: underline;">Manage your email preferences</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 20px;">
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #d1d5db;">
                      &copy; {$year} BoxTasks. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
  }

  /**
   * Builds the greeting section.
   *
   * @param \Drupal\user\UserInterface $user
   *   The recipient user.
   *
   * @return string
   *   The greeting HTML.
   */
  protected function buildGreeting(UserInterface $user): string {
    $name = $this->getUserDisplayName($user);
    return <<<HTML
<p style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 18px; color: #1f2937;">
  Hi {$name},
</p>
HTML;
  }

  /**
   * Builds a call-to-action button.
   *
   * @param string $url
   *   The button URL.
   * @param string $text
   *   The button text.
   * @param string $color
   *   The button color (hex).
   *
   * @return string
   *   The button HTML.
   */
  protected function buildButton(string $url, string $text, string $color = '#3B82F6'): string {
    return <<<HTML
<table border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr>
    <td align="center" style="padding: 25px 0;">
      <table border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" class="button-td" style="border-radius: 6px; background: {$color};">
            <a href="{$url}" class="button-a" style="background: {$color}; border: 15px solid {$color}; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.2; text-align: center; text-decoration: none; display: block; border-radius: 6px; font-weight: bold;">
              <span style="color:#ffffff;">{$text}</span>
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
HTML;
  }

  /**
   * Builds a card info box.
   *
   * @param string $title
   *   The card title.
   * @param string|null $description
   *   Optional description.
   * @param string|null $badge
   *   Optional badge text.
   * @param string $badge_color
   *   Badge color.
   *
   * @return string
   *   The card box HTML.
   */
  protected function buildCardBox(string $title, ?string $description = NULL, ?string $badge = NULL, string $badge_color = '#3B82F6'): string {
    $badge_html = $badge ? <<<HTML
<span style="display: inline-block; background: {$badge_color}; color: white; font-size: 11px; padding: 3px 8px; border-radius: 3px; margin-left: 10px; vertical-align: middle;">
  {$badge}
</span>
HTML : '';

    $desc_html = $description ? <<<HTML
<p style="margin: 10px 0 0 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280; line-height: 1.5;">
  {$description}
</p>
HTML : '';

    return <<<HTML
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
  <tr>
    <td style="background: #f3f4f6; border-left: 4px solid #3B82F6; padding: 20px; border-radius: 0 6px 6px 0;">
      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #1f2937;">
        {$title}{$badge_html}
      </p>
      {$desc_html}
    </td>
  </tr>
</table>
HTML;
  }

  /**
   * Builds a quote/comment box.
   *
   * @param string $text
   *   The quoted text.
   * @param string|null $author
   *   Optional author name.
   *
   * @return string
   *   The quote HTML.
   */
  protected function buildQuote(string $text, ?string $author = NULL): string {
    $author_html = $author ? <<<HTML
<p style="margin: 10px 0 0 0; font-family: Arial, sans-serif; font-size: 12px; color: #9ca3af;">
  &mdash; {$author}
</p>
HTML : '';

    return <<<HTML
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
  <tr>
    <td style="background: #fafafa; border-left: 3px solid #d1d5db; padding: 15px; border-radius: 0 6px 6px 0;">
      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #4b5563; font-style: italic; line-height: 1.6;">
        "{$text}"
      </p>
      {$author_html}
    </td>
  </tr>
</table>
HTML;
  }

  /**
   * Builds an info row with icon.
   *
   * @param string $icon
   *   The icon character or emoji.
   * @param string $label
   *   The label text.
   * @param string $value
   *   The value text.
   *
   * @return string
   *   The info row HTML.
   */
  protected function buildInfoRow(string $icon, string $label, string $value): string {
    return <<<HTML
<tr>
  <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td width="30" style="font-size: 16px;">{$icon}</td>
        <td style="font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">{$label}</td>
        <td align="right" style="font-family: Arial, sans-serif; font-size: 14px; color: #1f2937; font-weight: 500;">{$value}</td>
      </tr>
    </table>
  </td>
</tr>
HTML;
  }

  /**
   * Generates the welcome email template.
   *
   * @param \Drupal\user\UserInterface $user
   *   The new user.
   *
   * @return string
   *   The complete HTML email.
   */
  public function welcomeEmail(UserInterface $user): string {
    $frontend_url = $this->getFrontendUrl();
    $name = $this->getUserDisplayName($user);

    $content = $this->buildGreeting($user);
    $content .= <<<HTML
<p style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563; line-height: 1.6;">
  Welcome to <strong>BoxTasks</strong>! We're excited to have you on board.
</p>

<p style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563; line-height: 1.6;">
  BoxTasks is a powerful task management platform designed to help you and your team stay organized, collaborate effectively, and get things done.
</p>

<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
  <tr>
    <td style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px; padding: 25px;">
      <h3 style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 18px; color: #1e40af;">
        Here's what you can do with BoxTasks:
      </h3>
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding: 8px 0;">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td width="30" style="font-size: 18px;">📋</td>
                <td style="font-family: Arial, sans-serif; font-size: 14px; color: #1e3a5f;"><strong>Create Boards</strong> &mdash; Organize your projects visually</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td width="30" style="font-size: 18px;">✅</td>
                <td style="font-family: Arial, sans-serif; font-size: 14px; color: #1e3a5f;"><strong>Manage Tasks</strong> &mdash; Track progress with cards and checklists</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td width="30" style="font-size: 18px;">👥</td>
                <td style="font-family: Arial, sans-serif; font-size: 14px; color: #1e3a5f;"><strong>Collaborate</strong> &mdash; Work with your team in real-time</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td width="30" style="font-size: 18px;">🔔</td>
                <td style="font-family: Arial, sans-serif; font-size: 14px; color: #1e3a5f;"><strong>Stay Notified</strong> &mdash; Get updates on tasks that matter to you</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<p style="margin: 0 0 10px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563; line-height: 1.6;">
  Ready to get started? Click the button below to go to your dashboard and create your first board!
</p>
HTML;

    $content .= $this->buildButton($frontend_url . '/dashboard', 'Go to Dashboard', self::BRAND_PRIMARY);

    $content .= <<<HTML
<p style="margin: 20px 0 0 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280; line-height: 1.6;">
  If you have any questions, feel free to reach out to our support team. We're here to help!
</p>

<p style="margin: 20px 0 0 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563;">
  Happy tasking!<br>
  <strong style="color: #3B82F6;">The BoxTasks Team</strong>
</p>
HTML;

    return $this->buildBaseTemplate($content, "Welcome to BoxTasks, {$name}! Get started with your task management journey.");
  }

  /**
   * Generates the assignment notification email.
   *
   * @param \Drupal\user\UserInterface $user
   *   The recipient user.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $actor_name
   *   The name of the person who assigned.
   * @param string $card_url
   *   The URL to the card.
   *
   * @return string
   *   The complete HTML email.
   */
  public function assignmentEmail(UserInterface $user, NodeInterface $card, string $actor_name, string $card_url): string {
    $card_title = $card->getTitle();
    $card_description = '';
    if ($card->hasField('field_card_description') && !$card->get('field_card_description')->isEmpty()) {
      $card_description = strip_tags($card->get('field_card_description')->value);
      if (strlen($card_description) > 150) {
        $card_description = substr($card_description, 0, 150) . '...';
      }
    }

    $content = $this->buildGreeting($user);
    $content .= <<<HTML
<p style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563; line-height: 1.6;">
  <strong style="color: #1f2937;">{$actor_name}</strong> has assigned you to a card:
</p>
HTML;

    $content .= $this->buildCardBox($card_title, $card_description ?: null, 'Assigned to you', self::BRAND_PRIMARY);
    $content .= $this->buildButton($card_url, 'View Card', self::BRAND_PRIMARY);

    $content .= <<<HTML
<p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">
  You can view and update this card by clicking the button above.
</p>
HTML;

    return $this->buildBaseTemplate($content, "{$actor_name} assigned you to: {$card_title}");
  }

  /**
   * Generates the mention notification email.
   *
   * @param \Drupal\user\UserInterface $user
   *   The recipient user.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $actor_name
   *   The name of the person who mentioned.
   * @param string $comment_text
   *   The comment text containing the mention.
   * @param string $card_url
   *   The URL to the card.
   *
   * @return string
   *   The complete HTML email.
   */
  public function mentionEmail(UserInterface $user, NodeInterface $card, string $actor_name, string $comment_text, string $card_url): string {
    $card_title = $card->getTitle();

    // Truncate comment if too long
    $preview = strip_tags($comment_text);
    if (strlen($preview) > 300) {
      $preview = substr($preview, 0, 300) . '...';
    }

    $content = $this->buildGreeting($user);
    $content .= <<<HTML
<p style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563; line-height: 1.6;">
  <strong style="color: #1f2937;">{$actor_name}</strong> mentioned you in a comment on:
</p>
HTML;

    $content .= $this->buildCardBox($card_title, null, '@mention', '#9333EA');
    $content .= $this->buildQuote($preview, $actor_name);
    $content .= $this->buildButton($card_url, 'View Comment', '#9333EA');

    return $this->buildBaseTemplate($content, "{$actor_name} mentioned you: \"{$preview}\"");
  }

  /**
   * Generates the comment notification email.
   *
   * @param \Drupal\user\UserInterface $user
   *   The recipient user.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $actor_name
   *   The name of the person who commented.
   * @param string $comment_text
   *   The comment text.
   * @param string $card_url
   *   The URL to the card.
   *
   * @return string
   *   The complete HTML email.
   */
  public function commentEmail(UserInterface $user, NodeInterface $card, string $actor_name, string $comment_text, string $card_url): string {
    $card_title = $card->getTitle();

    // Truncate comment if too long
    $preview = strip_tags($comment_text);
    if (strlen($preview) > 300) {
      $preview = substr($preview, 0, 300) . '...';
    }

    $content = $this->buildGreeting($user);
    $content .= <<<HTML
<p style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563; line-height: 1.6;">
  <strong style="color: #1f2937;">{$actor_name}</strong> commented on a card you follow:
</p>
HTML;

    $content .= $this->buildCardBox($card_title, null, 'New Comment', self::BRAND_SUCCESS);
    $content .= $this->buildQuote($preview, $actor_name);
    $content .= $this->buildButton($card_url, 'View Comment', self::BRAND_PRIMARY);

    return $this->buildBaseTemplate($content, "{$actor_name} commented on: {$card_title}");
  }

  /**
   * Generates the due date reminder email.
   *
   * @param \Drupal\user\UserInterface $user
   *   The recipient user.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $timeframe
   *   When the card is due (e.g., "tomorrow", "in 1 hour").
   * @param string $due_date
   *   The formatted due date.
   * @param string $card_url
   *   The URL to the card.
   *
   * @return string
   *   The complete HTML email.
   */
  public function dueDateEmail(UserInterface $user, NodeInterface $card, string $timeframe, string $due_date, string $card_url): string {
    $card_title = $card->getTitle();

    // Determine urgency color
    $urgency_color = self::BRAND_WARNING;
    if (strpos(strtolower($timeframe), 'overdue') !== false) {
      $urgency_color = self::BRAND_DANGER;
    }

    $content = $this->buildGreeting($user);

    // Handle overdue vs upcoming due dates
    $is_overdue = ($timeframe === 'overdue');
    $due_text = $is_overdue ? 'overdue' : "due {$timeframe}";

    $content .= <<<HTML
<p style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563; line-height: 1.6;">
  A card you're assigned to is <strong style="color: {$urgency_color};">{$due_text}</strong>:
</p>
HTML;

    $badge_text = $is_overdue ? 'Overdue' : ($timeframe === 'today' ? 'Due Today' : ($timeframe === 'tomorrow' ? 'Due Tomorrow' : "Due {$timeframe}"));
    $content .= $this->buildCardBox($card_title, null, $badge_text, $urgency_color);

    $content .= <<<HTML
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background: #fef3c7; border-radius: 8px; padding: 15px;">
  <tr>
    <td>
      <table border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td width="30" style="font-size: 20px; vertical-align: top;">⏰</td>
          <td style="font-family: Arial, sans-serif; font-size: 14px; color: #92400e;">
            <strong>Due Date:</strong> {$due_date}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
HTML;

    $content .= $this->buildButton($card_url, 'View Card', $urgency_color);

    $subject = $is_overdue
      ? "Reminder: \"{$card_title}\" is overdue"
      : "Reminder: \"{$card_title}\" is due {$timeframe}";
    return $this->buildBaseTemplate($content, $subject);
  }

  /**
   * Generates the card completed notification email.
   *
   * @param \Drupal\user\UserInterface $user
   *   The recipient user.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $actor_name
   *   The name of the person who completed the card.
   * @param string $card_url
   *   The URL to the card.
   *
   * @return string
   *   The complete HTML email.
   */
  public function cardCompletedEmail(UserInterface $user, NodeInterface $card, string $actor_name, string $card_url): string {
    $card_title = $card->getTitle();

    $content = $this->buildGreeting($user);
    $content .= <<<HTML
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
  <tr>
    <td align="center">
      <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563; line-height: 1.6;">
        <strong style="color: #1f2937;">{$actor_name}</strong> completed a card:
      </p>
    </td>
  </tr>
</table>
HTML;

    $content .= $this->buildCardBox($card_title, null, 'Completed', self::BRAND_SUCCESS);
    $content .= $this->buildButton($card_url, 'View Card', self::BRAND_SUCCESS);

    return $this->buildBaseTemplate($content, "{$actor_name} completed: {$card_title}");
  }

  /**
   * Generates the member removed notification email.
   *
   * @param \Drupal\user\UserInterface $user
   *   The recipient user.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $actor_name
   *   The name of the person who removed them.
   * @param string $card_url
   *   The URL to the card.
   *
   * @return string
   *   The complete HTML email.
   */
  public function memberRemovedEmail(UserInterface $user, NodeInterface $card, string $actor_name, string $card_url): string {
    $card_title = $card->getTitle();

    $content = $this->buildGreeting($user);
    $content .= <<<HTML
<p style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563; line-height: 1.6;">
  <strong style="color: #1f2937;">{$actor_name}</strong> removed you from the following card:
</p>
HTML;

    $content .= $this->buildCardBox($card_title, null, 'Removed', '#6B7280');

    $content .= <<<HTML
<p style="margin: 20px 0 0 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">
  You will no longer receive notifications for this card unless you are re-assigned.
</p>
HTML;

    return $this->buildBaseTemplate($content, "You were removed from: {$card_title}");
  }

  /**
   * Generates the card moved notification email.
   *
   * @param \Drupal\user\UserInterface $user
   *   The recipient user.
   * @param \Drupal\node\NodeInterface $card
   *   The card entity.
   * @param string $actor_name
   *   The name of the person who moved the card.
   * @param string $from_list
   *   The source list name.
   * @param string $to_list
   *   The destination list name.
   * @param string $card_url
   *   The URL to the card.
   *
   * @return string
   *   The complete HTML email.
   */
  public function cardMovedEmail(UserInterface $user, NodeInterface $card, string $actor_name, string $from_list, string $to_list, string $card_url): string {
    $card_title = $card->getTitle();

    $content = $this->buildGreeting($user);
    $content .= <<<HTML
<p style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563; line-height: 1.6;">
  <strong style="color: #1f2937;">{$actor_name}</strong> moved a card you follow:
</p>
HTML;

    $content .= $this->buildCardBox($card_title, null, 'Moved', self::BRAND_PRIMARY);

    $content .= <<<HTML
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
  <tr>
    <td align="center">
      <table border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background: #f3f4f6; padding: 10px 20px; border-radius: 6px; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">
            {$from_list}
          </td>
          <td style="padding: 0 15px; font-size: 20px; color: #9ca3af;">→</td>
          <td style="background: #dbeafe; padding: 10px 20px; border-radius: 6px; font-family: Arial, sans-serif; font-size: 14px; color: #1e40af; font-weight: bold;">
            {$to_list}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
HTML;

    $content .= $this->buildButton($card_url, 'View Card', self::BRAND_PRIMARY);

    return $this->buildBaseTemplate($content, "{$actor_name} moved \"{$card_title}\" to {$to_list}");
  }

  /**
   * Generates the goal progress notification email.
   *
   * @param \Drupal\user\UserInterface $user
   *   The recipient user.
   * @param string $goal_title
   *   The goal title.
   * @param int $progress
   *   The progress percentage (0-100).
   * @param string $goal_url
   *   The URL to the goal.
   *
   * @return string
   *   The complete HTML email.
   */
  public function goalProgressEmail(UserInterface $user, string $goal_title, int $progress, string $goal_url): string {
    $progress_color = $progress >= 75 ? self::BRAND_SUCCESS : ($progress >= 50 ? self::BRAND_WARNING : self::BRAND_PRIMARY);

    $content = $this->buildGreeting($user);
    $content .= <<<HTML
<p style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563; line-height: 1.6;">
  There's been progress on a goal you're tracking:
</p>
HTML;

    $content .= <<<HTML
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; background: #f9fafb; border-radius: 8px; padding: 20px;">
  <tr>
    <td>
      <p style="margin: 0 0 10px 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #1f2937;">
        🎯 {$goal_title}
      </p>
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="background: #e5e7eb; border-radius: 4px; height: 12px;">
            <div style="background: {$progress_color}; width: {$progress}%; height: 12px; border-radius: 4px;"></div>
          </td>
          <td width="60" style="padding-left: 15px; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: {$progress_color};">
            {$progress}%
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
HTML;

    $content .= $this->buildButton($goal_url, 'View Goal', self::BRAND_PRIMARY);

    return $this->buildBaseTemplate($content, "Goal Update: {$goal_title} is at {$progress}%");
  }

  /**
   * Generates a generic notification email.
   *
   * @param \Drupal\user\UserInterface $user
   *   The recipient user.
   * @param string $subject
   *   The email subject.
   * @param string $message
   *   The notification message.
   * @param string|null $action_url
   *   Optional action URL.
   * @param string|null $action_text
   *   Optional action button text.
   *
   * @return string
   *   The complete HTML email.
   */
  public function genericEmail(UserInterface $user, string $subject, string $message, ?string $action_url = NULL, ?string $action_text = NULL): string {
    $content = $this->buildGreeting($user);
    $content .= <<<HTML
<p style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563; line-height: 1.6;">
  {$message}
</p>
HTML;

    if ($action_url && $action_text) {
      $content .= $this->buildButton($action_url, $action_text, self::BRAND_PRIMARY);
    }

    return $this->buildBaseTemplate($content, $subject);
  }

}
