# Agent Note: Chico 蚂小财 product brand

Status: implemented

English | [中文](2026-08-16-chico-ma-xiaocai-brand.zh.md)

## Problem

The Chico browser build inherited the shared DeepSeek Harness title, whale wordmark, favicon, install metadata, and welcome notice. Users therefore saw the framework brand instead of the product identity even though the Chico profile already composed a distinct investment workbench.

## Decision

The Chico delivery workspace presents the product as `蚂小财 Harness`. The browser document title, session-title suffix, install manifest, welcome notice, expanded sidebar wordmark, collapsed-rail mark, blank-session hero, and favicon use that identity. The visual mark is an ant rendered from local SVG geometry and follows the existing foreground color in light and dark themes.

Provider identities remain unchanged. DeepSeek model names, the official-provider setup flow, credential keys, package scopes, wire identifiers, and repository terminology still describe the backend and framework they address; product presentation does not rewrite those technical names.

## Alternatives considered

**Rename every DeepSeek occurrence in the repository.** Rejected because many occurrences identify the official model provider, npm scope, API credentials, wire values, or the upstream framework. Changing them would break configuration or misrepresent the backend rather than rebrand Chico.

**Keep the whale and change only visible text.** Rejected because the mark and favicon are the strongest persistent brand cues, including the browser tab and collapsed sidebar where no product text is visible.

**Use a remote image asset.** Rejected because the application must retain its complete brand offline and must not add an external request before the user takes any action.

## Consequences

The compiled Chico Web artifacts contain one coherent product identity across browser chrome, onboarding, and navigation. The ant SVG is bundled locally and adds no network dependency. This workspace intentionally changes the shared Web presentation used by the Chico profile; technical DeepSeek identifiers continue to appear where they identify a provider or framework contract.
