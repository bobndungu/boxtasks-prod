# Social Auth Microsoft

Social Auth Microsoft is a Microsoft authentication integration for Drupal. It
is based on the Social Auth and Social API projects.

It adds to the site:
- A new url: `/user/login/microsoft`.
- A settings form at `/admin/config/social-api/social-auth/microsoft`.
- A Microsoft logo in the Social Auth Login block.

For a full description of the module, visit the
[project page](https://www.drupal.org/project/social_auth_microsoft).

Submit bug reports and feature suggestions, or track changes in the
[issue queue](https://www.drupal.org/project/issues/social_auth_microsoft).


## Table of contents

- Requirements
- Installation
- Configuration
- How it works
- Support requests
- Maintainers


## Requirements

This module requires the following modules:

- [Social Auth](https://drupal.org/project/social_auth)
- [Social API](https://drupal.org/project/social_api)


## Installation

Install as you would normally install a contributed Drupal module. For further
information, see
[Installing Drupal Modules](https://www.drupal.org/docs/extending-drupal/installing-drupal-modules).


## Configuration

In Drupal:

1. Log in as an admin.
2. Navigate to Configuration » User authentication » Microsoft and copy
   the Authorized redirect URL field value (the URL should end in
   `/user/login/microsoft/callback`).
   In [Azure Portal](https://portal.azure.com/):
3. Log in to a Microsoft account.
4. Navigate to
   [App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
5. Click Register an application.
6. Set the app name and account type as desired.
7. Under Redirect URI select "`Web`" from the platform options and paste the
    URL from Step 2 in the field.
8. Click Register.
9. On the app Overview page copy the Application (client) ID value and store
    it somewhere safe.
10. Navigate to Certificates & secrets » Client secrets.
11. Click New client secret.
12. Set the fields as desired and click Add.
13. Copy the secret (in the Value column, *not* the Secret ID column) and
     store it somewhere safe.

In Drupal:

14. Return to Configuration » User authentication » Microsoft.
15. Enter the Microsoft client ID in the Client ID field.
16. Enter the Microsoft secret value in the Client secret field.
17. Click Save configuration.
18. Navigate to Structure » Block Layout and place a Social Auth login block
    somewhere on the site (if not already placed).


## How it works

The user can click on the Microsoft logo on the Social Auth Login block
You can also add a button or link anywhere on the site that points
to `/user/login/microsoft`, so theming and customizing the button or link
is very flexible.

After Microsoft has returned the user to your site, the module compares the user
id or email address provided by Microsoft. If your site already has an account
with the same email address or the user has previously registered using
Microsoft, the user is logged in. If not, a new user account is created. Also, a
Microsoft account can be associated with an authenticated user.


## Support requests

- Before posting a support request, carefully read the installation
  instructions provided in module documentation page.
- Before posting a support request, check the Recent Log entries at
  `admin/reports/dblog`
- Once you have done this, you can post a support request at module issue
  queue: [https://www.drupal.org/project/issues/social_auth_microsoft](https://www.drupal.org/project/issues/social_auth_microsoft)
- When posting a support request, please inform if you were able to see any
  errors in the Recent Log entries.


## Maintainers

- Christopher C. Wells - [wells](https://www.drupal.org/u/wells)
- Getulio Valentin Sánchez - [gvso](https://www.drupal.org/u/gvso)
- Himanshu Dixit - [himanshu-dixit](https://www.drupal.org/u/himanshu-dixit)
- Kifah Meeran - [MaskyS](https://www.drupal.org/u/maskys)

**Development sponsored by:**
- [Cascade Public Media](https://www.drupal.org/cascade-public-media)
