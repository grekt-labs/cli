# Refactor Attack Plan

Coupling issues found during codebase audit (2026-02-19).
High severity items are being addressed separately.

## Moderate Severity

### 1. `instanceof` rompe abstraccion Publisher (3 usos)
- `commands/publish.ts:315,414` — `instanceof CustomPublisher` para acceder `getRegistry()`
- `artifact/publish/publish.ts:148` — `instanceof S3Publisher` para acceder `hasCredentials()`
- `getRegistry()` y `hasCredentials()` no estan en la interfaz `Publisher`
- **Fix:** Agregar metodos al interface o usar `publisher.type` con datos en `PublishResult`

### 2. `validateForPublish` muta estado global de sesion
- `artifact/publish/publish.ts:55` llama `setProjectRoot(projectRoot)` dentro de una funcion de validacion
- Side effect oculto en funcion que deberia ser pura
- **Fix:** Eliminar la llamada. `setProjectRoot` es deprecated y no se necesita

### 3. Dependencia circular `context <-> config`
- `context/engine.ts:17` importa `LOCKFILE` desde `#/config/paths/paths`
- `context/tokens.ts:2` importa `getToken` desde `#/config/project/project`
- `config/project/project.ts:3` importa `fs` desde `#/context`
- **Fix:** Mover constantes de paths a `constants.ts` o que `engine.ts` reciba el path como parametro

### 4. `deprecate`/`undeprecate` hardcodeados a Supabase
- `commands/deprecate.ts:2` y `commands/undeprecate.ts:2` importan `createRegistryClient` del api-client
- Solo funcionan con registry default o S3 legacy, no custom registries
- Documentado como limitacion pero la razon es coupling
- **Fix:** Usar publisher pattern o resolver + factory como hace upgrade

### 5. `parseArtifactId` duplicado con posible divergencia
- `registry/resolver/resolver.ts:26-50` — implementacion local con ARTIFACT_ID_REGEX
- `@grekt/engine` — exporta su propia version
- Callers mixtos: algunos usan la local, otros la del engine
- **Fix:** Eliminar la local, usar solo la del cli-engine

## Minor Severity

### 6. Lockfile leido doble en `check` y `index`
- `artifact/check/check.ts:30` — `runCheck(projectRoot)` llama `getLockfile` internamente
- `artifact/index/index.ts:49` — `generateArtifactIndex` llama `getLockfile` internamente
- Sus callers ya tienen el lockfile cargado (add, install, remove, upgrade, check)
- **Fix:** Recibir lockfile como parametro en ambas funciones

### 7. Display mezclado con dominio en `check.ts`
- `artifact/check/check.ts` contiene `runCheck` (dominio) junto a `displayCheckResults` (UI)
- `displayCompactCheckResults` parece no usarse desde ningun command
- Patron correcto ya existe en `artifact/upgrade/display.ts`
- **Fix:** Mover display a `artifact/check/display.ts`

### 8. Magic string `"(lazy mode)"` como protocolo
- `sync/base/base.ts:251` — `result.skipped.push(\`${artifactId} (lazy mode)\`)`
- `sync/helpers/helpers.ts:82` — parsea el string para extraer reason
- **Fix:** Cambiar `SyncResult.skipped` a `{ path: string; reason: "lazy" | "missing" | "unsafe-path" }[]`

### 9. `parseArtifactVersion` duplicado identico
- `commands/deprecate.ts:18-28` y `commands/undeprecate.ts:17-27` — misma funcion copy-paste
- **Fix:** Extraer a shared utility

### 10. `setProjectRoot` deprecated pero usado en 5 sitios
- `commands/login.ts:82`, `commands/logout.ts:14`, `commands/deprecate.ts:59`
- `commands/undeprecate.ts:49`, `artifact/publish/publish.ts:55`
- Funcion marcada `@deprecated`, `_projectRoot` no lo lee nadie significativo
- **Fix:** Eliminar todas las llamadas y luego eliminar la funcion

### 11. Command importa de otro command (workspace)
- `commands/publish.ts:22` — `import { loadWorkspace } from "./workspace"`
- `loadWorkspace` tiene logica de negocio (yaml parse, glob, discover)
- **Fix:** Mover `loadWorkspace` a `artifact/workspace/` o similar

### 12. `getArtifactMode` duplicado con logica diferente
- `artifact/index/index.ts:21-41` — prioriza lockfile > config > default
- `sync/base/base.ts:51-62` — solo mira config > default
- **Fix:** Unificar en una sola funcion compartida, decidir cual semantica es correcta
