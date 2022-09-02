// @ts-check
import { NodeApp } from 'astro/app/node';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { polyfill } from '@astrojs/webapi';
import { fileURLToPath } from 'url';

polyfill(globalThis, {
	exclude: 'window document',
});

/**
 * @typedef {import('./types').ServerArgs} ServerArgs
 * @typedef {import('./types').DefineFastifyRoutes} DefineFastifyRoutes
 */

/** @type {DefineFastifyRoutes | undefined} */
const fastifyRoutes =
// @ts-ignore
typeof _astroFastifyRoutes != 'undefined' ? _astroFastifyRoutes : undefined;

/**
 * 
 * @param {import('astro').SSRManifest} manifest 
 * @param {ServerArgs} options 
 */
export function start(manifest, options) {
  const app = new NodeApp(manifest);

  const fastify = Fastify({
    logger: true
  });

  const clientRoot = new URL(options.clientRelative, import.meta.url);
  const clientAssetsRoot = new URL('.' + options.assetsPrefix, clientRoot + '/');

  fastify.register(fastifyStatic, {
    root: fileURLToPath(clientAssetsRoot),
    prefix: options.assetsPrefix,
  });

  if(fastifyRoutes) {
    fastifyRoutes(fastify);
  }
  
  // Fallback route
  fastify.get('/*', async function (request, reply) {
    const routeData = app.match(request.raw, { matchNotFound: true });
    if(routeData) {
      const response = await app.render(request.raw, routeData);
      await writeWebResponse(reply.raw, response);
    } else {
      reply.status(404).type('text/plain').send('Not found');
    }
  });

  fastify.listen({
    port: 8080,
    host: '0.0.0.0'
  }, function (err, address) {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }
    // Server is now listening on ${address}
  });
}

/**
 * 
 * @param {import('http').ServerResponse} res 
 * @param {Response} webResponse 
 */
async function writeWebResponse(res, webResponse) {
	const { status, headers, body } = webResponse;
	res.writeHead(status, Object.fromEntries(headers.entries()));
	if (body) {
		for await (const chunk of /** @type {any} */(body)) {
			res.write(chunk);
		}
	}
	res.end();
}

export function createExports(manifest, options) {
  return {
    start() {
      return start(manifest, options);
    }
  }
}