<?php

namespace Drupal\Tests\mercure\Kernel;

use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\KernelTests\KernelTestBase;
use Symfony\Component\Mercure\HubInterface;

/**
 * Tests the module configures a HubInterface.
 *
 * @group mercure
 */
class PublishTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'mercure',
  ];

  /**
   * {@inheritdoc}
   */
  public function register(ContainerBuilder $container) {
    $container->setParameter('mercure', [
      'hubs' => [
        'default' => [
          'url' => 'https://demo.mercure.rocks/.well-known/mercure',
          'jwt' => [
            'secret' => '!ChangeThisMercureHubJWTSecretKey!',
            'publish' => ['*'],
          ],
        ],
      ],
    ]);
    parent::register($container);
  }

  /**
   * Test the service container contains the 'mercure.hub.default' service.
   */
  public function testHubIsConfigured(): void {
    $hub = $this->container->get('mercure.hub.default');
    $this->assertInstanceOf(HubInterface::class, $hub);

    $this->assertEquals(
      'https://demo.mercure.rocks/.well-known/mercure',
      $hub->getUrl()
    );

    // The following publish works. You can assert this at:
    // https://demo.mercure.rocks/.well-known/mercure/ui/
    // Make sure you are subscribed to the '*' topic. Uncomment to test.
    // $hub->publish(new Update('*', 'Hello world'));.
  }

}
