<?php

namespace Drupal\mercure;

use Drupal\Core\DependencyInjection\ServiceProviderInterface;
use Drupal\mercure\DependencyInjection\MercureExtension;
use Symfony\Bundle\MercureBundle\MercureBundle;
use Symfony\Component\DependencyInjection\Compiler\CompilerPassInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;

/**
 * Registers the symfony/mercure-bundle MercureExtension and MercureBundle.
 */
class MercureServiceProvider implements ServiceProviderInterface {

  /**
   * {@inheritdoc}
   */
  public function register(ContainerBuilder $container): void {
    $container->addCompilerPass(new class() implements CompilerPassInterface {

      /**
       * {@inheritdoc}
       */
      public function process(ContainerBuilder $container): void {
        if (!$container->hasParameter('mercure')) {
          return;
        }

        (new MercureExtension())->load(
          ['mercure' => $container->getParameter('mercure')],
          $container,
        );
      }

    }, priority: 100);

    (new MercureBundle())->build($container);
  }

}
