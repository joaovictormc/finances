# Identificação de itens que necessitam de correções durante o teste do app web

### Visão Geral
- Durante os testes no linux de homologação, a tela de visão geral não abre de forma natural, somente passando /overview na url. Mesmo assim, passando o destino na url ela não carregava os balanços de transação já cadastrado.


### Importação de extratos
- Importação está muito manual, quando uma pessoa precisar de importar o extrato de varios meses ela precisa selecionar um arquivo, importar e depois repetir o processo várias vezes. Podemos redefinir essa função deixando possível importar arquivos em massa tanto para área de cartão de crédito como extrato de conta corrente

### Transações
- Podemos realizar uma funcionalidade para fazer uma conciliação das categorias de transções em massa ao invés de realizar uma por uma, pois após ser importado elas não possuem categoria definida

### Desempenho do backend/frontend
- Algumas operações simples, como troca de tela, estão demorando para serem processadas, ficam em loading infinito ou levam um tempo considerável para abrir


### Layout e design
- Quando clico no collapse do menu lateral, podemos incluir o botão de abrir o menu novamente por cima da logomarca do app, quando o usuário passar o mouse por cima da logo o botão aparece aplicando um blur por cima da logo e mostrando o icone de abir menu

- Usar Skill: https://github.com/pbakaus/impeccable para refatorar o frontend deixando um visual exclusivo e diferente na web e mobile


### Ajustes do backend
- Como estou testando a aplicação em ambiente diferente do de desenvolvimento, as categorias de transações não estão aparecendo nesse ambiente


### Segurança de dados, operações e LGPD
- Valide se todas as operções e arquivos definidos estão de acordo com a LGPD e se estão bem protegidos 


### Sugestão de categorias com IA
- Verificar e sugerir a atribuição de categorias para as transações, não categorizar automático, somente sugestão

- Diferenciar pagamentos de faturas de cartão para não ser inclusas como dinheiro recebido