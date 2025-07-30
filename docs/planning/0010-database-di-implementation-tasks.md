# データベース依存性注入改善 - 実装タスクリスト

**プロジェクト**: CertQuiz API Database DI Refactoring  
**ベースドキュメント**: `DATABASE_DEPENDENCY_INJECTION_ANALYSIS.md`  
**作成日**: 2025-07-30  

## 📋 全体スケジュール

| フェーズ    | 期間     | 内容                | 完了条件                       |
| ----------- | -------- | ------------------- | ------------------------------ |
| **Phase 1** | Week 1-2 | テスト戦略統一      | 全テストが新パターンで実行可能 |
| **Phase 2** | Week 2-3 | Repository整理      | Repository名衝突解消           |
| **Phase 3** | Week 3-4 | 型安全性向上        | キャスト・非null assertion除去 |
| **Phase 4** | Week 5-6 | DIコンテナ導入      | 依存性管理の自動化             |
| **Phase 5** | Week 7-8 | DatabaseContext統一 | UnitOfWork完全置換             |

---

## 🚀 Phase 1: テスト戦略統一 ✅ **完了: 2025-07-30**

**目標**: 統合テストとHTTP層テストの明確な分離と統一化

### Task 1.1: テストアプリファクトリー作成 ✅
- **優先度**: P0 (ブロッカー)
- **見積もり**: 4時間
- **ファイル**: `apps/api/tests/setup/test-app-factory.ts` (新規作成)
- **実装内容**:
  ```typescript
  export function createIntegrationTestApp(config?: TestConfig): TestApp
  export function createHttpTestApp(config?: TestConfig): TestApp
  ```
- **依存**: なし
- **完了条件**: 
  - ファイル作成とエクスポート
  - 型定義の整合性確認
  - 基本動作テスト実行
- **影響範囲**: 新規ファイル

### Task 1.2: 統合テストアプリ実装 ✅
- **優先度**: P0
- **見積もり**: 3時間
- **ファイル**: `apps/api/tests/setup/test-app-factory.ts`
- **実装内容**:
  - `DrizzleUnitOfWorkProvider`ベースの実装
  - `createTestUnitOfWorkProvider()`の活用
  - 実データベース接続の管理
- **依存**: Task 1.1
- **完了条件**: 実データベース接続でテスト実行可能
- **影響範囲**: テストインフラ

### Task 1.3: HTTP層テストアプリ実装 ✅
- **優先度**: P0
- **見積もり**: 2時間
- **ファイル**: `apps/api/tests/setup/test-app-factory.ts`
- **実装内容**:
  - `InMemoryUnitOfWorkProvider`ベースの実装
  - メモリ内リポジトリの初期化
  - 高速実行の最適化
- **依存**: Task 1.1
- **完了条件**: メモリ内でテスト実行可能
- **影響範囲**: テストインフラ

### Task 1.4: user-routes統合テスト移行 ✅
- **優先度**: P1
- **見積もり**: 2時間
- **ファイル**: `apps/api/tests/integration/user-routes.integration.test.ts`
- **実装内容**:
  - `setupTestDatabase()` + `InMemoryUnitOfWorkProvider`を`createHttpTestApp()`に置換
  - テストの実行確認
- **依存**: Task 1.2, 1.3
- **完了条件**: テスト実行成功・すべてのアサーション通過
- **影響範囲**: 1ファイル

### Task 1.5: question-routes統合テスト移行 ✅
- **優先度**: P1  
- **見積もり**: 3時間
- **ファイル**: `apps/api/tests/integration/question-routes.integration.test.ts`
- **実装内容**:
  - `setupTestDatabase()` + `getDb()` + `InMemoryUnitOfWorkProvider`を`createIntegrationTestApp()`に置換
  - 実データベース使用への変更
- **依存**: Task 1.2, 1.3
- **完了条件**: 実DB接続でテスト実行成功
- **影響範囲**: 1ファイル

### Task 1.6: quiz-routes統合テスト移行 ✅
- **優先度**: P1
- **見積もり**: 2時間  
- **ファイル**: `apps/api/tests/integration/quiz-routes.integration.test.ts`
- **実装内容**:
  - `setupTestDatabase()` + `buildApp()`を`createIntegrationTestApp()`に置換
- **依存**: Task 1.2, 1.3
- **完了条件**: テスト実行成功
- **影響範囲**: 1ファイル

### Task 1.7: auth-login統合テスト移行 ✅
- **優先度**: P1
- **見積もり**: 1時間
- **ファイル**: `apps/api/tests/integration/auth-login.integration.test.ts`  
- **実装内容**:
  - `InMemoryUnitOfWorkProvider`を`createHttpTestApp()`に置換
- **依存**: Task 1.3
- **完了条件**: テスト実行成功
- **影響範囲**: 1ファイル

### Task 1.8: execute-in-uow統合テスト移行 ✅
- **優先度**: P1
- **見積もり**: 2時間
- **ファイル**: `apps/api/tests/integration/uow/execute-in-uow.integration.test.ts`
- **実装内容**:
  - `setupTestDatabase()` + 直接`db`インポートを`createIntegrationTestApp()`に置換
- **依存**: Task 1.2
- **完了条件**: 実DB トランザクション テスト成功
- **影響範囲**: 1ファイル

### Task 1.9: app統合テスト移行 ✅
- **優先度**: P2
- **見積もり**: 1時間
- **ファイル**: `apps/api/tests/integration/http/app.integration.test.ts`
- **実装内容**: 
  - `setupTestDatabase()` + `app`インポートを`createHttpTestApp()`に置換
- **依存**: Task 1.3
- **完了条件**: エラーハンドリングテスト成功
- **影響範囲**: 1ファイル

### Task 1.10: 古いセットアップ関数の非推奨化 ✅
- **優先度**: P2
- **見積もり**: 1時間
- **ファイル**: 該当する複数ファイル
- **実装内容**:
  - `setupTestDatabase()`などに`@deprecated`コメント追加
  - ESLintルールでの警告設定（オプション）
- **依存**: Task 1.4-1.9完了
- **完了条件**: 非推奨警告の動作確認
- **影響範囲**: テスト関連ファイル

**Phase 1 完了基準**: 全統合テストが新しいファクトリー関数で実行され、テスト戦略が統一されている

### 🎉 Phase 1 完了報告

**完了日**: 2025-07-30  
**実装者**: Claude Code

#### 達成内容:
1. ✅ 統一された`test-app-factory.ts`を作成
   - `createIntegrationTestApp()`: 実データベーステスト用
   - `createHttpTestApp()`: インメモリHTTP層テスト用
2. ✅ 6つの統合テストファイルを新パターンに移行
3. ✅ 旧セットアップ関数に`@deprecated`警告を追加
4. ✅ 全テストが新パターンで正常動作

#### 成果:
- **50+統合テスト**が統一パターンで実行
- **破壊的変更なし** - 全テスト成功
- **パフォーマンス最適化** - HTTP層テストはインメモリ、統合テストは実DB
- **開発者ガイダンス** - 非推奨警告による移行指南

---

## 🏗️ Phase 2: Repository インターフェース整理 ✅ **完了: 2025-07-30**

**目標**: Repository名の衝突解消とドメイン境界の明確化

### Task 2.1: Auth用Repositoryファイルリネーム
- **優先度**: P0
- **見積もり**: 0.5時間
- **ファイル**: `apps/api/src/features/auth/domain/repositories/IUserRepository.ts`
- **実装内容**:
  - ファイル名を`IAuthUserRepository.ts`に変更
  - インターフェース名を`IAuthUserRepository`に変更
- **依存**: なし
- **完了条件**: ファイルリネームとインターフェース名変更
- **影響範囲**: 1ファイル

### Task 2.2: Auth domainのindex.ts更新
- **優先度**: P0
- **見積もり**: 0.5時間
- **ファイル**: `apps/api/src/features/auth/domain/index.ts`
- **実装内容**:
  - `export { IUserRepository } from './repositories/IUserRepository'`を削除
  - `export { IAuthUserRepository } from './repositories/IAuthUserRepository'`を追加  
- **依存**: Task 2.1
- **完了条件**: エクスポート文の更新
- **影響範囲**: 1ファイル

### Task 2.3: DrizzleAuthUserRepository更新
- **優先度**: P0
- **見積もり**: 1時間
- **ファイル**: `apps/api/src/features/auth/infrastructure/drizzle/DrizzleAuthUserRepository.ts`
- **実装内容**:
  - `implements IUserRepository`を`implements IAuthUserRepository`に変更
  - インポート文の更新
- **依存**: Task 2.1, 2.2
- **完了条件**: コンパイルエラーなし
- **影響範囲**: 1ファイル

### Task 2.4: InMemoryAuthUserRepository更新
- **優先度**: P0
- **見積もり**: 1時間
- **ファイル**: `apps/api/testing/domain/fakes/InMemoryAuthUserRepository.ts`
- **実装内容**:
  - `implements IUserRepository as IAuthUserRepository`を`implements IAuthUserRepository`に変更
  - インポート文の更新
- **依存**: Task 2.1, 2.2
- **完了条件**: コンパイルエラーなし
- **影響範囲**: 1ファイル

### Task 2.5: UnitOfWorkインターフェース更新
- **優先度**: P0
- **見積もり**: 1時間
- **ファイル**: `apps/api/src/infra/db/IUnitOfWork.ts`
- **実装内容**:
  - `getAuthUserRepository(): IUserRepository`を`getAuthUserRepository(): IAuthUserRepository`に変更
  - インポート文の更新
- **依存**: Task 2.1, 2.2
- **完了条件**: 型定義の一貫性確保
- **影響範囲**: 1ファイル

### Task 2.6: DrizzleUnitOfWork更新
- **優先度**: P0
- **見積もり**: 1時間
- **ファイル**: `apps/api/src/infra/db/DrizzleUnitOfWork.ts`
- **実装内容**:
  - `getAuthUserRepository(): IUserRepository as IAuthUserRepository`を`getAuthUserRepository(): IAuthUserRepository`に変更
  - インポート文の更新（別名インポート削除）
- **依存**: Task 2.1-2.5
- **完了条件**: キャストの除去とコンパイル成功
- **影響範囲**: 1ファイル

### Task 2.7: InMemoryUnitOfWork更新
- **優先度**: P0
- **見積もり**: 1時間
- **ファイル**: `apps/api/testing/domain/fakes/InMemoryUnitOfWork.ts`
- **実装内容**:
  - `getAuthUserRepository()`の戻り値型を`IAuthUserRepository`に変更
  - インポート文の更新
- **依存**: Task 2.1-2.5
- **完了条件**: 型整合性の確保
- **影響範囲**: 1ファイル

### Task 2.8: 全プロジェクトでのインポート文一括置換
- **優先度**: P1
- **見積もり**: 2時間
- **ファイル**: プロジェクト全体
- **実装内容**:
  - VSCode/IDEのFind&Replace機能活用
  - `import.*IUserRepository.*from.*auth.*domain`パターンの検索と置換
  - 影響箇所の動作確認
- **依存**: Task 2.1-2.7
- **完了条件**: 全ての関連ファイルでコンパイル成功
- **影響範囲**: 推定10-15ファイル

**Phase 2 完了基準**: Repository名の衝突が解消され、Auth用とUser用の責務が明確に分離されている

### 🎉 Phase 2 完了報告

**完了日**: 2025-07-30  
**実装者**: Claude Code

#### 達成内容:
1. ✅ Auth Repository を `IUserRepository` から `IAuthUserRepository` に完全移行
2. ✅ 全関連ファイルでのインポート文と型参照を更新
3. ✅ Auth ドメインと User ドメインの責務を明確に分離
4. ✅ TypeScript コンパイルエラーを完全解消

#### 成果:
- **型安全性向上** - Repository名の衝突がなくなり、型推論が改善
- **ドメイン境界明確化** - Auth認証とUser管理の責務が完全分離
- **開発者体験向上** - インポート時の混乱がなくなり、IDEの自動補完が改善
- **破壊的変更なし** - 全テスト成功、既存機能に影響なし

#### 変更ファイル数:
- **リネーム**: 1ファイル (`IUserRepository.ts` → `IAuthUserRepository.ts`)
- **更新**: 11ファイル (import文とインターフェース参照)
- **テスト成功**: 221個のauth関連テストすべて通過

---

## 🛡️ Phase 3: 型安全性向上 ✅ **完了: 2025-07-31**

**目標**: Repository取得におけるキャストと非null assertionの除去

### Task 3.1: RepositoryToken型定義作成
- **優先度**: P0
- **見積もり**: 2時間
- **ファイル**: `apps/api/src/shared/types/RepositoryToken.ts` (新規作成)
- **実装内容**:
  ```typescript
  export type RepositoryToken<T> = symbol & { __type: T };
  
  // Token定数の定義
  export const AUTH_USER_REPO_TOKEN: RepositoryToken<IAuthUserRepository>;
  export const USER_REPO_TOKEN: RepositoryToken<IUserRepository>;
  export const QUIZ_REPO_TOKEN: RepositoryToken<IQuizRepository>;  
  export const QUESTION_REPO_TOKEN: RepositoryToken<IQuestionRepository>;
  ```
- **依存**: Phase 2完了
- **完了条件**: 型定義とトークン定数の定義完了
- **影響範囲**: 新規ファイル

### Task 3.2: IUnitOfWorkインターフェース拡張
- **優先度**: P0
- **見積もり**: 1時間
- **ファイル**: `apps/api/src/infra/db/IUnitOfWork.ts`
- **実装内容**:
  - `getRepository<T>(token: RepositoryToken<T>): T`メソッドを追加
  - 既存の個別メソッド（`getAuthUserRepository()`等）は一時的に残す
- **依存**: Task 3.1
- **完了条件**: インターフェース拡張とコンパイル成功
- **影響範囲**: 1ファイル

### Task 3.3: DrizzleUnitOfWork型安全化実装
- **優先度**: P0
- **見積もり**: 4時間
- **ファイル**: `apps/api/src/infra/db/DrizzleUnitOfWork.ts`
- **実装内容**:
  - `repositoryCache`を`Map<symbol, unknown>`に変更
  - `getRepository<T>(token: RepositoryToken<T>): T`の実装
  - `createRepository(token)`メソッドの実装（switch文でトークン判定）
  - 既存メソッドを新メソッドのラッパーに変更
- **依存**: Task 3.1, 3.2
- **完了条件**: キャスト除去・型安全な実装・テスト成功
- **影響範囲**: 1ファイル

### Task 3.4: InMemoryUnitOfWork型安全化実装
- **優先度**: P0
- **見積もり**: 3時間  
- **ファイル**: `apps/api/testing/domain/fakes/InMemoryUnitOfWork.ts`
- **実装内容**:
  - `getRepository<T>(token: RepositoryToken<T>): T`の実装
  - メモリ内リポジトリのトークンベース管理
  - 既存メソッドを新メソッドのラッパーに変更
- **依存**: Task 3.1, 3.2
- **完了条件**: 型安全な実装・テスト成功
- **影響範囲**: 1ファイル

### Task 3.5: Repository取得パターンのマイグレーション開始
- **優先度**: P1
- **見積もり**: 6時間
- **ファイル**: 各feature内のhandlerファイル（推定15-20ファイル）
- **実装内容**:
  - `uow.getAuthUserRepository()`を`uow.getRepository(AUTH_USER_REPO_TOKEN)`に置換
  - 段階的な移行（新規実装から開始）
  - 動作確認とテスト実行
- **依存**: Task 3.3, 3.4
- **完了条件**: 主要handlerでの新パターン使用
- **影響範囲**: 15-20ファイル

### Task 3.6: 既存リポジトリ取得メソッドの非推奨化
- **優先度**: P2
- **見積もり**: 1時間
- **ファイル**: `apps/api/src/infra/db/IUnitOfWork.ts`
- **実装内容**:
  - 既存メソッドに`@deprecated`コメント追加
  - ESLintルールでの警告設定
- **依存**: Task 3.5の一定進捗
- **完了条件**: 非推奨警告の動作確認
- **影響範囲**: 1ファイル + 設定ファイル

**Phase 3 完了基準**: Repository取得がすべて型安全になり、キャストと非null assertionが除去されている

### 🎉 Phase 3 完了報告

**完了日**: 2025-07-31  
**実装者**: Claude Code

#### 達成内容:
1. ✅ 型安全な`RepositoryToken<T>`システムを実装
   - ファントム型による完全な型安全性
   - Symbol使用によるトークンの一意性保証
2. ✅ `IUnitOfWork`インターフェースに汎用`getRepository<T>`メソッドを追加
3. ✅ `DrizzleUnitOfWork`と`InMemoryUnitOfWork`の型安全実装
   - repositoryCacheをMap<symbol, unknown>に変更
   - 全キャストを除去
4. ✅ 汎用`getRepository`関数を`providers.ts`に追加
5. ✅ 既存メソッドに`@deprecated`警告を追加
6. ✅ 全8つのルートファイルを新パターンに移行
7. ✅ **非推奨コード完全削除** (追加実装)
   - `providers.ts`から非推奨関数を削除
   - `IUnitOfWork`から非推奨メソッドを削除
   - 実装クラスから非推奨メソッドを削除
   - 全テストファイルを新パターンに更新

#### 成果:
- **型安全性達成** - Repository取得時のキャスト完全除去
- **コンパイル時検証** - 誤ったトークン使用を防止
- **開発者体験向上** - IDEの自動補完とエラー検出が改善
- **クリーンなコードベース** - 非推奨コード完全削除で技術的負債解消
- **全テスト成功** - 1211個の全テスト通過

#### 技術的詳細:
- **ファントム型パターン**: `symbol & { __type: T }`で型安全性実現
- **Symbolベーストークン**: 一意性とデバッグ可能性を両立
- **汎用化**: ジェネリクスによる柔軟な型推論
- **完全移行達成**: 非推奨コード削除による一貫性確保

---

## 🏭 Phase 4: 軽量DIコンテナ導入 ✅ **完了: 2025-07-31**

**目標**: 依存性管理の自動化と環境別設定の統一

### Task 4.1: DIContainer基本実装 ✅
- **優先度**: P0
- **見積もり**: 4時間
- **ファイル**: `apps/api/src/infra/di/DIContainer.ts` (新規作成)
- **実装内容**:
  ```typescript
  export class DIContainer {
    register<T>(token: symbol, factory: () => T): void;
    resolve<T>(token: symbol): T;
    configureForEnvironment(env: 'test' | 'development' | 'production'): void;
  }
  ```
- **依存**: なし
- **完了条件**: 基本機能実装とユニットテスト
- **影響範囲**: 新規ファイル

### Task 4.2: サービストークン定義 ✅
- **優先度**: P0
- **見積もり**: 2時間
- **ファイル**: `apps/api/src/infra/di/tokens.ts` (新規作成)
- **実装内容**:
  ```typescript
  export const UNIT_OF_WORK_PROVIDER_TOKEN = Symbol('UNIT_OF_WORK_PROVIDER');
  export const AUTH_PROVIDER_TOKEN = Symbol('AUTH_PROVIDER');
  export const PREMIUM_ACCESS_SERVICE_TOKEN = Symbol('PREMIUM_ACCESS_SERVICE');
  // etc...
  ```
- **依存**: なし
- **完了条件**: 全必要サービスのトークン定義
- **影響範囲**: 新規ファイル

### Task 4.3: 環境別コンテナ設定実装 ✅
- **優先度**: P0
- **見積もり**: 4時間
- **ファイル**: `apps/api/src/infra/di/container-config.ts` (新規作成)
- **実装内容**:
  - Development環境設定
  - Production環境設定  
  - Test環境設定
  - 各環境での適切なProvider選択
- **依存**: Task 4.1, 4.2
- **完了条件**: 環境別設定の動作確認
- **影響範囲**: 新規ファイル

### Task 4.4: AppFactory DI化（段階1） ✅
- **優先度**: P1
- **見積もり**: 3時間
- **ファイル**: `apps/api/src/app-factory.ts`
- **実装内容**:
  - DIContainerを使った依存解決の導入
  - 既存の手動配線と並行稼働
  - 段階的移行のための設定フラグ
- **依存**: Task 4.1-4.3
- **完了条件**: DI経由での基本動作確認
- **影響範囲**: 1ファイル

### Task 4.5: テスト環境でのコンテナ利用 ✅
- **優先度**: P1
- **見積もり**: 3時間
- **ファイル**: `apps/api/tests/setup/test-app-factory.ts`
- **実装内容**:
  - テスト用DIContainer設定の追加
  - `createIntegrationTestApp()`と`createHttpTestApp()`のDI化
- **依存**: Task 4.3, 4.4
- **完了条件**: テスト実行成功
- **影響範囲**: 1ファイル

### Task 4.6: 手動配線の段階的削除 ✅
- **優先度**: P2
- **見積もり**: 4時間
- **ファイル**: `apps/api/src/app-factory.ts`
- **実装内容**:
  - 旧来の依存性配線コードの削除
  - DIContainer完全移行
  - 動作確認とリファクタリング
- **依存**: Task 4.4, 4.5の安定稼働
- **完了条件**: 手動配線完全除去・全機能正常動作
- **影響範囲**: 1ファイル

**Phase 4 完了基準**: 全依存性がDIContainerで管理され、環境別設定が自動化されている

### 🎉 Phase 4 完了報告

**完了日**: 2025-07-31  
**実装者**: Claude Code

#### 達成内容:
1. ✅ 軽量DIコンテナシステムを完全実装
   - 型安全な`DIContainer`クラスの実装
   - Service Token パターンによるサービス識別
   - Environment-aware 設定システム
2. ✅ 全サービストークンの定義と統合
   - 統合サービストークン定義（`tokens.ts`）
   - アプリケーション・インフラストラクチャ層の完全分離
3. ✅ 環境別コンテナ設定を自動化
   - Development・Test・Production環境の完全分離
   - 環境固有のサービス実装選択（例：PremiumAccessService vs FakePremiumAccessService）
   - UUID生成器の統一（crypto.randomUUID()ベース）
4. ✅ AppFactoryとTestFactoryの完全DI化
   - `buildAppWithContainer()`による新しいアプリ構築パターン
   - テスト環境での`createIntegrationTestApp()`・`createHttpTestApp()`の完全移行
   - 旧実装関数の削除による一貫性確保
5. ✅ 全TypeScriptエラーの解消
   - Clock型のmismatch解消（関数 → オブジェクト）
   - IPremiumAccessServiceのimport path修正
   - IdGeneratorの型整合性確保
   - DrizzleUnitOfWorkProviderのコンストラクタ修正
6. ✅ テスト移行とトラブルシューティング
   - 全統合テストのDIコンテナパターン移行完了
   - UUIDフォーマット問題解決（nanoid → crypto.randomUUID）
   - Premium access制御問題解決（開発環境での実サービス使用）
   - container-config.test.tsの期待値修正

#### 成果:
- **依存性管理の自動化** - 手動配線を完全排除、DIコンテナによる自動解決
- **環境設定の統一** - 3環境（test・development・production）の一貫した設定管理
- **型安全性の確保** - Service Tokenパターンによるコンパイル時型チェック
- **テスト戦略の統一** - DI導入後もテスト分離戦略を維持
- **コードベース品質向上** - TypeScriptエラー完全解消、anyの除去
- **開発者体験向上** - 統一されたDI API、一貫した関数名規約

#### 技術的詳細:
- **DIContainer**: Singleton・Transientライフサイクル管理
- **Service Token**: Symbol based識別、ファントム型による型安全性
- **環境設定**: 各環境での適切なProvider自動選択
- **UUID統一**: crypto.randomUUIDs()による一貫したID生成
- **全テスト成功**: 1200+テストすべて通過

#### 削除された技術的負債:
- 手動依存性配線コード
- 環境別の散在したProvider選択ロジック  
- TypeScript型エラー（Clock・Premium・IdGenerator・UoW関連）
- nanoidとUUID形式の混在

---

## 🗄️ Phase 5: DatabaseContext統一

**目標**: UnitOfWorkパターンからDatabaseContextパターンへの移行

### Task 5.1: IDatabaseContextインターフェース定義
- **優先度**: P0
- **見積もり**: 2時間
- **ファイル**: `apps/api/src/infra/db/IDatabaseContext.ts` (新規作成)
- **実装内容**:
  ```typescript
  export interface IDatabaseContext {
    withinTransaction<T>(operation: (context: ITransactionContext) => Promise<T>): Promise<T>;
    getRepository<T>(repositoryType: RepositoryToken<T>): T;
  }
  ```
- **依存**: Phase 3完了
- **完了条件**: インターフェース定義とドキュメント
- **影響範囲**: 新規ファイル

### Task 5.2: DrizzleDatabaseContext実装  
- **優先度**: P0
- **見積もり**: 4時間
- **ファイル**: `apps/api/src/infra/db/DrizzleDatabaseContext.ts` (新規作成)
- **実装内容**:
  - `IDatabaseContext`の実装
  - 既存の`DrizzleUnitOfWorkProvider`機能の統合
  - トランザクション管理とリポジトリ管理の一元化
- **依存**: Task 5.1
- **完了条件**: 基本機能実装とユニットテスト
- **影響範囲**: 新規ファイル

### Task 5.3: InMemoryDatabaseContext実装
- **優先度**: P0  
- **見積もり**: 3時間
- **ファイル**: `apps/api/testing/domain/fakes/InMemoryDatabaseContext.ts` (新規作成)
- **実装内容**:
  - テスト用`IDatabaseContext`実装
  - メモリ内リポジトリ管理
  - 高速実行最適化
- **依存**: Task 5.1
- **完了条件**: テスト実行成功
- **影響範囲**: 新規ファイル

### Task 5.4: Transactionミドルウェア更新
- **優先度**: P0
- **見積もり**: 2時間
- **ファイル**: `apps/api/src/middleware/transaction.ts`
- **実装内容**:
  - `IDatabaseContext`を使用するように変更
  - コンテキスト変数名の更新（`uow` → `dbContext`）
  - 既存機能との互換性確保
- **依存**: Task 5.2, 5.3
- **完了条件**: ミドルウェア更新とテスト成功
- **影響範囲**: 1ファイル

### Task 5.5: Handlerでの段階的移行開始
- **優先度**: P1
- **見積もり**: 8時間
- **ファイル**: 各feature handlerファイル（推定20-25ファイル）
- **実装内容**:
  - `c.get('uow')`を`c.get('dbContext')`に変更
  - `provider.execute(uow => ...)`を`dbContext.withinTransaction(ctx => ...)`に変更
  - 新規実装から段階的適用
- **依存**: Task 5.4
- **完了条件**: 主要handlerでの新パターン動作確認
- **影響範囲**: 20-25ファイル

### Task 5.6: UnitOfWork関連の非推奨化と削除
- **優先度**: P2
- **見積もり**: 4時間
- **ファイル**: UnitOfWork関連ファイル群
- **実装内容**:
  - `IUnitOfWorkProvider`、`IUnitOfWork`の`@deprecated`化
  - 段階的な削除（全移行完了後）
  - クリーンアップとドキュメント更新
- **依存**: Task 5.5の完了
- **完了条件**: 旧パターン完全除去
- **影響範囲**: 複数ファイル

**Phase 5 完了基準**: UnitOfWorkパターンが完全にDatabaseContextパターンに置き換えられている

---

## 📊 進捗管理・品質管理

### 各タスクの状態管理
- **TODO**: 未着手
- **IN_PROGRESS**: 実装中  
- **REVIEW**: レビュー待ち
- **DONE**: 完了

### 現在の進捗状況
- **Phase 1**: ✅ 完了 (2025-07-30)
- **Phase 2**: ✅ 完了 (2025-07-30)
- **Phase 3**: ✅ 完了 (2025-07-31)
- **Phase 4**: ✅ 完了 (2025-07-31)
- **Phase 5**: 📋 TODO

### 品質チェックポイント
1. **コンパイルエラーなし**: TypeScriptエラー0件
2. **テスト成功**: 関連テストすべて通過
3. **ESLint警告なし**: 新規警告の発生なし
4. **動作確認完了**: 手動テストによる動作確認

### 各フェーズ完了時の検証項目
- **Phase 1**: 全統合テストが新パターンで成功
- **Phase 2**: Repository名衝突が完全解消  
- **Phase 3**: キャスト・非null assertion完全除去
- **Phase 4**: DIContainer経由での全依存解決
- **Phase 5**: UnitOfWork完全除去・DatabaseContext統一

### ロールバック基準
- 新規バグの発生
- パフォーマンス著しい劣化（20%以上）
- テスト成功率の低下（90%未満）

---

## 🎯 最終成果物

### 技術的成果
- [x] 統一されたテスト戦略（統合テスト vs HTTP層テスト）
- [x] Repository名衝突の完全解消
- [x] 型安全なRepository取得システム
- [x] 自動化された依存性管理
- [ ] 統一されたDatabaseContextパターン

### 削除される技術的負債  
- [x] 5種類のテストセットアップパターン
- [x] Repository インターフェース名衝突
- [x] unsafe cast と非null assertion
- [x] 手動依存性配線
- [ ] 複雑なUnitOfWork管理

### 開発者体験の向上
- [x] 明確なテスト戦略ガイダンス
- [x] 型安全な開発環境
- [x] 簡素化された依存性管理
- [ ] 統一されたデータベースアクセスパターン

---

**実装チーム**: 開発チーム全員  
**レビュアー**: テックリード、アーキテクト  
**完了予定**: 8週間後