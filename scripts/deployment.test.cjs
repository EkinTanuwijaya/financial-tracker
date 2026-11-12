const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

test('production isolates internal services, budgets RAM, and mounts Nginx TLS read-only', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-deployment-'));
  const file = path.join(directory, 'deployment.env');
  const settings = {
    IMAGE_PREFIX: 'ghcr.io/example/finance',
    IMAGE_TAG: 'test',
    POSTGRES_PASSWORD: 'test-only-password',
    JWT_SECRET: 'test-only-secret',
    APP_ORIGIN: 'https://192.0.2.1',
  };
  const env = { ...process.env };
  for (const key of Object.keys(settings)) delete env[key];
  const render = (values) => {
    fs.writeFileSync(file, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n'));
    return spawnSync('docker', ['compose', '--env-file', file, '-f', 'docker-compose.prod.yml', 'config', '--format', 'json'], {
      cwd: path.join(__dirname, '..'), env, encoding: 'utf8',
    });
  };
  try {
    const result = render(settings);
    assert.equal(result.status, 0, result.stderr);
    const { services } = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(services).filter((key) => services[key].ports?.length), ['nginx']);
    assert.equal(services.nginx.image, 'nginx:stable-alpine');
    for (const target of ['/etc/nginx/conf.d/default.conf', '/etc/nginx/tls']) {
      const mount = services.nginx.volumes.find((volume) => volume.target === target);
      assert.ok(mount?.read_only, `${target} must be mounted read-only`);
    }
    assert.equal(services.backend.environment.NODE_ENV, 'production');
    for (const name of ['backend', 'dashboard', 'ocr']) {
      assert.ok(!services[name].build, `${name} must use a prebuilt image`);
      assert.ok(!(services[name].volumes || []).some((volume) => volume.type === 'bind'));
    }
    const memory = Object.values(services).reduce((total, service) => {
      assert.ok(service.mem_limit > 0, 'Every service needs a memory limit');
      return total + Number(service.mem_limit);
    }, 0);
    assert.ok(memory <= 3.5 * 1024 ** 3, 'Leave RAM for the VPS operating system');

    const publicTls = render({ ...settings, APP_ORIGIN: 'https://finance.example.com' });
    assert.equal(publicTls.status, 0, publicTls.stderr);
    assert.equal(JSON.parse(publicTls.stdout).services.backend.environment.CORS_ORIGIN, 'https://finance.example.com');

    const missingPassword = render({ ...settings, POSTGRES_PASSWORD: '' });
    assert.notEqual(missingPassword.status, 0, 'An empty database password must block deployment');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
