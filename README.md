# Controle Integrado de Portaria — Colégio São José

O sistema usa Next.js e SQLite. O acesso local é [http://localhost:3000](http://localhost:3000).

## Kit offline para Windows x64

O ZIP inclui o aplicativo de produção, o Node.js 24.19.0 e os módulos nativos. A instalação usa o Agendador de Tarefas do Windows para iniciar com a máquina, mesmo sem login. O acesso fica restrito ao próprio computador. Leve a cópia de recuperação em outra mídia.

### Gerar o kit

Na máquina Windows x64 de preparo, instale as dependências do lockfile em uma cópia de desenvolvimento com Node.js 24.19.0. Na raiz do projeto, execute o comando abaixo com o `node.exe` oficial dessa versão no PATH e a licença da mesma distribuição disponível em disco. O empacotador confere o SHA-256 do executável e faz o build em uma pasta temporária isolada. [Versão oficial do Node.js](https://nodejs.org/en/blog/release/v24.19.0)

```powershell
.\scripts\windows-kit\New-WindowsKit.ps1 -NodeLicense 'C:\midia\node-v24.19.0-win-x64\LICENSE'
```

Transfira o ZIP identificado por versão e seu arquivo `.sha256`, ambos em `build\windows`. No destino, confira se o hash do ZIP obtido por `Get-FileHash .\CSJ-Portaria-*.zip` corresponde ao arquivo `.sha256` do mesmo pacote antes de extrair. Guarde a versão usada junto ao registro do teste de recuperação.

### Instalar e recuperar após formatação

1. Com a rede desligada, extraia o ZIP em uma pasta separada. Abra o Windows PowerShell como administrador na pasta extraída, execute `.\Install-Portaria.ps1` e defina a senha inicial de `admin` no prompt. Se a política local bloquear o script, confira o hash e siga a política de execução do Colégio.
2. Abra [http://localhost:3000](http://localhost:3000) e entre com a senha definida. Reinicie a máquina com a rede desligada e confirme que a página abre novamente. Para operação, use a tarefa `CSJ-Portaria` no Agendador. Os logs ficam em `C:\ProgramData\CSJ-Portaria\logs\portaria.log`.
3. Para recuperar uma instalação anterior, conecte a mídia de recuperação, faça uma cópia de trabalho do arquivo `.db` e use **Importar Banco (.db)** na interface administrativa. A importação restaura também os usuários, portanto entre novamente com as credenciais da base recuperada.
4. No ensaio de recuperação, use uma base sintética. Confira no histórico quem recebeu o item na última transferência, confirme a posse atual e registre uma devolução. Confirme no painel que o item ficou disponível.

O programa fica em `C:\Program Files\CSJ-Portaria`. A base, as cópias automáticas e os logs ficam em `C:\ProgramData\CSJ-Portaria`. Mantenha a cópia de recuperação fora do computador. As opções `-Destino`, `-Dados` e `-Porta` permitem informar caminhos e porta locais diferentes. Em laboratório, `-SemTarefa` prepara uma instalação isolada e informa o comando de partida manual.

## Preparar uma instalação existente com PM2

1. Baixe o instalador MSI oficial do Node.js para a arquitetura do Windows de destino. Use a mesma versão e arquitetura do Node no preparo e no destino, pois o projeto usa módulos nativos, como `better-sqlite3`. O lockfile exige Node 20.9 ou superior para o Next.js e limita `better-sqlite3` às séries declaradas em `package-lock.json`. Node 22 satisfaz esses requisitos declarados.
2. Em uma pasta de preparação separada da instalação em uso, prepare o PM2 para executar o build. Nessa máquina conectada, a instalação global pode ser feita com `npm install -g pm2`.
3. Execute `Build_Producao.bat` na pasta de preparação. Ele para o processo `sao-jose` na instância do PM2 que estiver em uso, instala as dependências, recria `.next`, copia `public` e `.next\static` para o standalone, chama o inicializador do banco e inicia ou reinicia o serviço. Use uma máquina ou instância do PM2 separada da portaria em operação.
4. Extraia o código do `pm2-installer` em uma pasta de preparação. Se o ponto de partida for o `pm2-installer-main.zip` local, o ZIP contém o código do instalador. Na pasta extraída e com rede, execute `npm run bundle` para gerar o cache offline do PM2.
5. Leve para a máquina de destino o MSI, a pasta completa do `pm2-installer` com o bundle gerado e a pasta da aplicação com `node_modules` e `.next` da preparação. Confira a presença de `.next\standalone\server.js`, `.next\standalone\public` e `.next\standalone\.next\static`. Para uma instalação nova, prepare essa cópia sem dados operacionais. Transporte a cópia de recuperação em mídia separada da aplicação.

## Instalar e operar com PM2

1. Instale o Node.js pelo MSI. Esse procedimento usa a instalação padrão do Node no Windows.
2. Copie a aplicação e a pasta completa do `pm2-installer` para o destino. Abra o PowerShell como administrador. Entre na pasta do instalador e execute:

   ```powershell
   npm run configure
   npm run configure-policy
   npm run setup
   ```

   O primeiro comando configura o prefixo e o cache do npm em `C:\ProgramData\npm` para acesso pela conta `Local Service`. O segundo verifica a política de execução do PowerShell e ajusta os estados `Undefined` e `Restricted` para `RemoteSigned`. O terceiro instala o serviço do PM2 e usa o cache preparado se o registro npm estiver inacessível. Após uma atualização do Node ou do npm, confira o prefixo e o cache da conta do serviço e, se necessário, execute `npm run configure` novamente.

3. Antes de disponibilizar o sistema, prepare a base conforme [Instalação nova e recuperação](#instalação-nova-e-recuperação). Na pasta da aplicação, use o PowerShell elevado para administrar a instância do PM2 do serviço:

   ```powershell
   pm2 start ecosystem.config.js
   pm2 save
   pm2 list
   ```

4. Abra [http://localhost:3000](http://localhost:3000) e confirme o acesso. Use `Ligar_Sistema.bat` para iniciar um build já pronto e `Desligar_Sistema.bat` para parar o processo. A partida usa a pasta do próprio script e o PM2 localiza o standalone relativamente ao `ecosystem.config.js`. Se a pasta da aplicação mudar depois de registrada, atualize o registro do processo no PM2, confira o novo caminho com `pm2 describe sao-jose` e salve novamente a configuração.

Na máquina offline, use o build e as dependências da mídia. Reserve `npm install` e `Build_Producao.bat` para a preparação com rede. Os logs configurados pelo PM2 ficam em `logs\app.log` e `logs\error.log`, na pasta da aplicação.

## Instalação nova e recuperação

### Localizar a base e proteger a cópia

O kit Windows define `CSJ_DATA_DIR` para apontar para a pasta de dados. Nas demais instalações, por padrão, `keys.db` e `backups` ficam no diretório de execução. O servidor standalone muda para a pasta que contém `server.js`. Com o PM2 configurado neste projeto, os caminhos esperados são `.next\standalone\keys.db` e `.next\standalone\backups`. Em desenvolvimento a partir da raiz, os caminhos ficam na raiz do projeto. Confirme o diretório efetivo da instalação antes de recuperar ou atualizar.

**Antes de qualquer rebuild em uma instalação existente**, preserve uma cópia SQLite consistente da base e os backups necessários fora de `.next`. O `Build_Producao.bat` remove essa árvore inteira. Enquanto o banco estiver aberto em modo WAL, copiar apenas `keys.db` pode deixar transações de fora. Preserve os auxiliares da base ativa sob controle do SQLite e use uma cópia consistente, validada em ambiente isolado, como fonte de recuperação.

### Instalação nova

O aplicativo cria o esquema completo ao iniciar em um diretório sem base. O inicializador de linha de comando usa o mesmo esquema e cria o administrador inicial. Quando chamado pelo build, ele atua na raiz do projeto. Em uma instalação standalone nova, execute o inicializador no diretório em que a aplicação vai abrir a base.

```powershell
Push-Location .next\standalone
try {
    node ..\..\scripts\init-db.js
} finally {
    Pop-Location
}
```

Depois do primeiro acesso, troque a senha inicial antes de liberar o uso. Para redefinir a senha de uma conta existente, o administrador informa uma nova senha na tela **Usuários do Sistema**.

### Recuperação após formatação ou troca de máquina

1. Reinstale a aplicação e o serviço do PM2 com a mídia preparada. Antes de iniciar o aplicativo, guarde a mídia que contém a cópia de recuperação e faça uma cópia de trabalho do arquivo.
2. Valide a integridade e a compatibilidade da cópia em ambiente isolado. O sistema aplica as migrações conhecidas durante a recuperação pela interface e ao abrir a base. A tabela abaixo identifica as diferenças esperadas em bases antigas.
3. Em uma instalação recém-reposta, com o aplicativo parado e o diretório de execução ainda sem base, coloque a cópia SQLite consistente e validada no caminho efetivo de `keys.db`. Inicie o aplicativo conforme a seção de operação.
4. Em uma instalação já em execução, preserve antes uma cópia consistente para reversão. Na interface administrativa, **Backups Disponíveis** permite restaurar um backup listado e **Importar Banco (.db)** recebe a cópia de trabalho de um arquivo externo. Antes da substituição, ambas as ações verificam a integridade SQLite e aplicam as migrações conhecidas em uma cópia temporária. Se a validação rejeitar o arquivo, a instalação continua com a base atual.
5. Depois de restaurar, confira o histórico e o responsável pela última transferência. No aceite do kit, faça a instalação e a reinicialização com a rede desligada, restaure a cópia sintética de mídia separada, confira a última transferência e registre uma devolução.

| Diferença no esquema antigo | Script de referência |
| --- | --- |
| Histórico sem `user_id` ou `username` | `patch.js` |
| Itens sem `employee_id` | `scripts/migrate_keys.js` |
| Usuários ou funcionários sem `active` | `scripts/add_active_column_to_users.js` e `scripts/migrate-employees-soft-delete.js` |
| Itens sem `active` | `scripts/migrate_keys_soft_delete.js` |
| Itens ou histórico sem `observation` | `scripts/add_observation_to_keys_and_history.js` |
| Itens sem `item_type` ou funcionários sem `entity_type` | `scripts/migration.js` |
| Tabela `settings` ausente | `scripts/add_settings_table.js` |

O backup automático e o comando **Gerar Backup Agora** usam o mecanismo de cópia do SQLite e incluem as transações confirmadas no WAL. Cada solicitação manual gera um arquivo distinto, inclusive no mesmo dia. A retenção configurada pode apagar cópias antigas da pasta de backups. Mantenha a cópia destinada à recuperação em mídia separada.

### Verificação com base sintética

Na máquina de desenvolvimento, com as dependências já instaladas, execute `node --test tests/recovery.integration.cjs`. O teste inicia uma instância local em um diretório temporário, cria as próprias bases e confere perfis, redefinição de senha, cópias em WAL, recuperação e o ciclo retirar, transferir e devolver.

## Desenvolvimento

Na pasta do projeto, execute `iniciar_sistema.bat` ou `npm run dev` com as dependências instaladas. O script de desenvolvimento recria `.next`. Use uma cópia de desenvolvimento separada da pasta em produção.

## Roadmap

1. Higienizar o repositório e consolidar o guia de instalação, operação e recuperação.
2. Proteger a redefinição de senha, garantir cópias SQLite consistentes em WAL, validar a recuperação e completar o esquema de novas instalações.
3. Melhorar a operação da portaria, incluindo posse e destino visíveis, fluxo por teclado e busca em todo o histórico.
4. Entregar o kit Windows versionado para instalação e recuperação com a rede desligada.
5. Padronizar paginação e filtros no Histórico de Movimentações, nos Logs de Auditoria e nas demais listagens que precisarem. Aproveitar a paginação e a busca já existentes. Avaliar filtros combináveis por período, ação, item, pessoa ou local e operador, conforme a tela. Os filtros devem atuar sobre todos os registros antes de paginar, permanecer ativos ao trocar de página e atualizar a contagem de resultados.
