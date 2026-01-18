# Grekt CLI - Plan de Implementación

## Sinopsis

1. **Objetivo**: CLI para gestionar artifacts de IA con sync a herramientas
2. **Arquitectura**: Registry Client + Local Storage + Sync Adapters
3. **Estructura de Artifact**: Agent con skills y commands relacionados
4. **Carpeta grekts/**: agents/, skills/, commands/ + installed.yaml como índice
5. **installed.yaml**: Source of truth con paths y relaciones
6. **Sync Claude**: Copia a estructura nativa .claude/
7. **Sync otras IAs**: Entry point mínimo + instrucción para commands
8. **Comandos**: init, add, remove, update, list, search, sync, publish, config, auth, check
9. **Selección interactiva**: Checkboxes para elegir skills/commands al instalar
10. **Archivos**: `grekt.lock` (raíz, commiteable) + `.grekt/` (cache, ignorado)
11. **Detección de conflictos**: Análisis de commands duplicados con resolución flexible
12. **Stack**: Node/Bun + Commander + Inquirer + Zod + YAML

---

## 1. Objetivo

CLI para gestionar artifacts de IA (agents, skills, commands) que:
- Descarga artifacts del registry (público o self-hosted)
- Sincroniza con herramientas AI (Claude nativo, otras vía entry point)
- Gestiona dependencias flat y explícitas
- Detecta y resuelve conflictos de commands

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         grekt CLI                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Core Commands                          │  │
│  │  init, add, remove, update, list, search, sync, publish  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ Registry Client │ │ Local Storage   │ │ Sync Adapters   │   │
│  │                 │ │                 │ │                 │   │
│  │ - fetch         │ │ - grekts/       │ │ - Claude        │   │
│  │ - publish       │ │ - grekt.lock    │ │ - Cursor        │   │
│  │ - search        │ │                 │ │ - Windsurf      │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Estructura de Carpetas

```
proyecto/
├── grekt.lock                    # commiteable - versiones exactas
├── .grekt/                       # ignorado - cache del CLI
│   └── config.yaml
│
├── grekts/                       # artifacts instalados
│   ├── installed.yaml            # índice universal (source of truth)
│   ├── agents/
│   │   └── code-reviewer.md
│   ├── skills/
│   │   └── testing.md
│   └── commands/
│       └── review.md
│
├── .claude/                      # sync nativo para Claude
│   ├── agents/
│   │   └── code-reviewer.md
│   ├── skills/
│   │   └── testing.md
│   └── CLAUDE.md
│
└── .cursorrules                  # entry point para Cursor
```

---

## 4. installed.yaml (Índice Universal)

```yaml
# grekts/installed.yaml
# Source of truth - generado por grekt CLI

version: 1

paths:
  agents: grekts/agents
  skills: grekts/skills
  commands: grekts/commands

agents:
  code-reviewer:
    description: Code review exhaustivo
    file: code-reviewer.md
    skills:
      - testing
      - git-analysis
    commands:
      - /review
      - /cr

skills:
  testing:
    description: Testing y cobertura
    file: testing.md
    used_by: code-reviewer
  git-analysis:
    description: Análisis de historial git
    file: git-analysis.md
    used_by: code-reviewer

commands:
  /review:
    description: Ejecutar code review
    file: review.md
    agent: code-reviewer
  /cr:
    alias: /review
```

**Tokens estimados**: 50-100 (para 2-5 agents típicos)

---

## 5. Sync por IA

### Claude (estructura nativa)

grekt copia archivos a la estructura de Claude:

```
grekts/agents/code-reviewer.md → .claude/agents/code-reviewer.md
grekts/skills/testing.md       → .claude/skills/testing.md
```

En `.claude/CLAUDE.md` (mínimo):
```markdown
<!-- GREKT -->
Grekts sincronizados. Ver .claude/agents/ y .claude/skills/
<!-- /GREKT -->
```

### Otras IAs (Cursor, Windsurf, etc.)

En `.cursorrules` / `.windsurfrules`:

```markdown
<!-- GREKT -->
Este proyecto usa grekt. Configuración en `grekts/installed.yaml`.

Si el usuario usa un comando (ej: /review), consulta `grekts/installed.yaml` para ver si existe y ejecuta las instrucciones del archivo correspondiente.
<!-- /GREKT -->
```

---

## 6. Comandos

| Comando | Descripción |
|---------|-------------|
| `grekt init` | Inicializa proyecto, crea grekts/ |
| `grekt add @scope/name` | Añade artifact (selección interactiva) |
| `grekt add @scope/name --all` | Añade todo sin preguntar |
| `grekt add @scope/name --minimal` | Solo prompt principal |
| `grekt remove @scope/name` | Elimina artifact |
| `grekt update` | Actualiza todos |
| `grekt list` | Lista instalados |
| `grekt list --outdated` | Muestra actualizaciones disponibles |
| `grekt search "query"` | Busca en registry |
| `grekt sync` | Sincroniza con herramientas AI |
| `grekt sync --dry-run` | Preview sin cambios |
| `grekt check` | Analiza conflictos de commands |
| `grekt publish` | Publica artifact |
| `grekt config set <key> <value>` | Configura opciones |
| `grekt config list` | Muestra configuración |
| `grekt auth` | Abre dashboard para obtener API key |
| `grekt auth --logout` | Elimina credenciales |

### Config Options

```bash
grekt config set registry https://internal.empresa.com
grekt config set telemetry false
grekt config set defaultTargets claude,cursor
grekt config set autoSync true
grekt config set grektsDir grekts        # carpeta por defecto
```

---

## 7. Selección Interactiva

```
$ grekt add @loquesea/code-reviewer

┌─────────────────────────────────────────────────┐
│ @loquesea/code-reviewer@1.2.0                   │
│                                                 │
│ Skills:                                         │
│   ◉ testing        - Análisis de tests          │
│   ◉ git-analysis   - Análisis git               │
│                                                 │
│ Commands:                                       │
│   ◉ /review        - Revisar código             │
│   ◉ /cr            - Alias de /review           │
│   ○ /test-coverage - Analizar cobertura         │
│                                                 │
│ (space marcar/desmarcar, enter confirmar)       │
└─────────────────────────────────────────────────┘
```

---

## 8. Archivos de Configuración

### grekt.lock (raíz, se commitea)

```yaml
version: 1

artifacts:
  "@loquesea/code-reviewer":
    version: "1.2.0"
    checksum: "sha256:abc123..."
    skills:
      testing: true
      git-analysis: true
    commands:
      /review: true
      /cr: true
      /test-coverage: false
```

### ~/.grekt/config.yaml (global)

```yaml
registry: https://registry.grekt.com
telemetry: true
defaultTargets:
  - claude
  - cursor
autoSync: false
```

### ~/.grekt/credentials.yaml (global, chmod 600)

```yaml
https://registry.grekt.com:
  token: grekt_sk_xxxxxxxxxxxx
```

### .grekt/config.yaml (proyecto)

```yaml
targets:
  - claude
  - cursor
grektsDir: grekts
```

---

## 9. Sync No Destructivo

```
grekt sync
    │
    ▼
¿Existe archivo de la IA? ─── NO ──→ "¿Crear archivo? [Y/n]"
    │
   SÍ
    │
    ▼
¿Existe bloque GREKT? ─── NO ──→ "¿Añadir bloque? [Y/n]"
    │
   SÍ
    │
    ▼
Actualizar SOLO el bloque GREKT
(contenido custom del usuario intacto)
```

---

## 10. Detección y Resolución de Conflictos

### Al instalar

```
$ grekt add @empresa/testing

⚠ Conflicto: /test

  Definido por:
    1. @grekt/testing    → "Ejecutar tests unitarios"
    2. @empresa/testing  → "Ejecutar tests E2E"

  ¿Qué hacer?
    ○ Mantener @grekt/testing (ignorar @empresa/testing)
    ○ Reemplazar con @empresa/testing
    ○ Crear alias
    ○ Usar ambos (submenu al ejecutar /test)
    ○ Cancelar
```

### Flujo "Crear alias"

```
  ¿Cuál conserva /test?
    ○ @grekt/testing conserva /test
    ○ @empresa/testing conserva /test

  Escribe alias para el otro: /etest

  ✓ @grekt/testing → /test
  ✓ @empresa/testing → /etest
```

### Flujo "Usar ambos"

Al ejecutar `/test`:
```
  ¿Cuál ejecutar?
    ○ @grekt/testing - Tests unitarios
    ○ @empresa/testing - Tests E2E
```

---

## 11. Auth

```bash
$ grekt auth

Abriendo dashboard en el navegador...
https://grekt.com/dashboard/tokens

Una vez generada la API key, pégala aquí:
> grekt_sk_xxxxxxxxxxxx

✓ Credenciales guardadas
✓ Conectado como @dygerydoo
```

---

## 12. Stack Técnico

| Componente | Tecnología |
|------------|------------|
| Runtime | Node.js / Bun |
| CLI Framework | Commander |
| Prompts | @inquirer/prompts |
| HTTP | ofetch |
| YAML | yaml |
| Validación | Zod |
| UI | chalk + ora |
| Checksum | SHA256 (crypto nativo) |

---

## 13. Fases de Implementación

### Fase 1: Core (Semana 1)
- Setup proyecto
- `grekt init` (crea grekts/, installed.yaml vacío)
- `grekt config`
- Estructura de archivos
- Prompts interactivos

### Fase 2: Registry + Add (Semana 2)
- Cliente HTTP
- `grekt search`
- `grekt add` con selección interactiva
- Genera installed.yaml
- `grekt remove`
- `grekt list`
- grekt.lock con SHA256

### Fase 3: Sync (Semana 3)
- Interface SyncAdapter
- Claude Adapter (copia a .claude/)
- Cursor/Windsurf Adapter (entry point + instrucción commands)
- `grekt sync` no destructivo
- Preservación de contenido custom

### Fase 4: Conflictos + Auth (Semana 4)
- Detección de commands duplicados
- Flujo completo de resolución
- `grekt check`
- `grekt auth`
- `grekt publish`

### Fase 5: Polish (Semana 5)
- `grekt update`
- Detección de outdated
- UX y mensajes claros
- Documentación

---

## 14. Ejemplo Flujo Completo

```bash
$ grekt init
✓ Created grekts/
✓ Created grekts/installed.yaml
? AI tools: ◉ Claude  ◉ Cursor
✓ Initialized grekt.lock

$ grekt auth
Abriendo https://grekt.com/dashboard/tokens...
Pega tu API key: grekt_sk_xxx
✓ Autenticado como @dygerydoo

$ grekt add @loquesea/code-reviewer
? Select components: (space to toggle)
  ◉ testing
  ◉ git-analysis
  ◉ /review
  ◉ /cr
✓ Installed @loquesea/code-reviewer@1.2.0
✓ Updated grekts/installed.yaml

$ grekt sync
Syncing Claude...
  ✓ Copied agents/code-reviewer.md → .claude/agents/
  ✓ Copied skills/testing.md → .claude/skills/
  ? Create .claude/CLAUDE.md? [Y] y
  ✓ Created .claude/CLAUDE.md

Syncing Cursor...
  ? .cursorrules exists, add grekt block? [Y] y
  ✓ Updated .cursorrules

$ grekt list
@loquesea/code-reviewer  1.2.0  agent
  ├─ skills: testing, git-analysis
  └─ commands: /review, /cr

$ grekt check
✓ No hay conflictos
```
