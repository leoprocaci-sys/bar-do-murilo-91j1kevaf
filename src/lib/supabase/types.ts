// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.17'
  }
  public: {
    Tables: {
      app_user_emails: {
        Row: {
          atualizado_em: string
          criado_em: string
          email_real: string
          id: string
          user_id: string
          verificado: boolean
          verificado_em: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          email_real: string
          id?: string
          user_id: string
          verificado?: boolean
          verificado_em?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          email_real?: string
          id?: string
          user_id?: string
          verificado?: boolean
          verificado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'app_user_emails_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      app_users: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          deve_alterar_senha: boolean
          id: string
          nome: string
          perfil: string
          username: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          deve_alterar_senha?: boolean
          id: string
          nome: string
          perfil?: string
          username: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          deve_alterar_senha?: boolean
          id?: string
          nome?: string
          perfil?: string
          username?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          apelido: string | null
          atualizado_em: string
          criado_em: string
          criado_por: string
          endereco: string | null
          favorito: boolean
          id: string
          limite_centavos: number | null
          nome: string
          restricao_ativa: boolean
          restricao_em: string | null
          restricao_motivo: string | null
          restricao_por: string | null
          telefone: string | null
        }
        Insert: {
          apelido?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por: string
          endereco?: string | null
          favorito?: boolean
          id?: string
          limite_centavos?: number | null
          nome: string
          restricao_ativa?: boolean
          restricao_em?: string | null
          restricao_motivo?: string | null
          restricao_por?: string | null
          telefone?: string | null
        }
        Update: {
          apelido?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por?: string
          endereco?: string | null
          favorito?: boolean
          id?: string
          limite_centavos?: number | null
          nome?: string
          restricao_ativa?: boolean
          restricao_em?: string | null
          restricao_motivo?: string | null
          restricao_por?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'clientes_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clientes_restricao_por_fkey'
            columns: ['restricao_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      comanda_itens: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          comanda_id: string
          data_movimento: string
          data_registro: string
          id: string
          justificativa_excecao: string | null
          preco_excepcional: boolean
          preco_unitario_centavos: number
          produto_id: string | null
          produto_nome: string
          quantidade: number
          registrado_por: string | null
          request_id: string
          seq: number
          status: string
          subtotal_centavos: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          comanda_id: string
          data_movimento?: string
          data_registro?: string
          id?: string
          justificativa_excecao?: string | null
          preco_excepcional?: boolean
          preco_unitario_centavos: number
          produto_id?: string | null
          produto_nome: string
          quantidade: number
          registrado_por?: string | null
          request_id: string
          seq?: never
          status?: string
          subtotal_centavos?: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          comanda_id?: string
          data_movimento?: string
          data_registro?: string
          id?: string
          justificativa_excecao?: string | null
          preco_excepcional?: boolean
          preco_unitario_centavos?: number
          produto_id?: string | null
          produto_nome?: string
          quantidade?: number
          registrado_por?: string | null
          request_id?: string
          seq?: never
          status?: string
          subtotal_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'comanda_itens_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comanda_itens_comanda_id_fkey'
            columns: ['comanda_id']
            isOneToOne: false
            referencedRelation: 'comandas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comanda_itens_produto_id_fkey'
            columns: ['produto_id']
            isOneToOne: false
            referencedRelation: 'produtos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comanda_itens_registrado_por_fkey'
            columns: ['registrado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      comanda_pagamentos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: string | null
          comanda_id: string
          consumo_id: string | null
          data_movimento: string
          data_registro: string
          forma: string
          id: string
          pago_posteriormente: boolean
          parcela_index: number | null
          registrado_por: string | null
          request_id: string
          seq: number
          status: string
          valor_centavos: number
          venda_direta_id: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string | null
          comanda_id: string
          consumo_id?: string | null
          data_movimento?: string
          data_registro?: string
          forma: string
          id?: string
          pago_posteriormente?: boolean
          parcela_index?: number | null
          registrado_por?: string | null
          request_id: string
          seq?: never
          status?: string
          valor_centavos: number
          venda_direta_id?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string | null
          comanda_id?: string
          consumo_id?: string | null
          data_movimento?: string
          data_registro?: string
          forma?: string
          id?: string
          pago_posteriormente?: boolean
          parcela_index?: number | null
          registrado_por?: string | null
          request_id?: string
          seq?: never
          status?: string
          valor_centavos?: number
          venda_direta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'comanda_pagamentos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comanda_pagamentos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comanda_pagamentos_comanda_id_fkey'
            columns: ['comanda_id']
            isOneToOne: false
            referencedRelation: 'comandas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comanda_pagamentos_registrado_por_fkey'
            columns: ['registrado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      comandas: {
        Row: {
          aberto_por: string | null
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: string | null
          data_abertura: string
          data_fechamento: string | null
          data_movimento: string
          data_registro: string
          fechado_por: string | null
          id: string
          identificacao: string | null
          local_referencia: string | null
          mesa: string | null
          numero: number
          registrado_por: string | null
          status: string
        }
        Insert: {
          aberto_por?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string | null
          data_abertura?: string
          data_fechamento?: string | null
          data_movimento?: string
          data_registro?: string
          fechado_por?: string | null
          id?: string
          identificacao?: string | null
          local_referencia?: string | null
          mesa?: string | null
          numero?: never
          registrado_por?: string | null
          status?: string
        }
        Update: {
          aberto_por?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string | null
          data_abertura?: string
          data_fechamento?: string | null
          data_movimento?: string
          data_registro?: string
          fechado_por?: string | null
          id?: string
          identificacao?: string | null
          local_referencia?: string | null
          mesa?: string | null
          numero?: never
          registrado_por?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comandas_aberto_por_fkey'
            columns: ['aberto_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comandas_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comandas_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comandas_fechado_por_fkey'
            columns: ['fechado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comandas_registrado_por_fkey'
            columns: ['registrado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      consumos: {
        Row: {
          cliente_id: string
          data_movimento: string
          data_registro: string
          descricao: string | null
          id: string
          registrado_por: string
          request_id: string
          seq: number
          status: string
          valor_centavos: number
        }
        Insert: {
          cliente_id: string
          data_movimento: string
          data_registro?: string
          descricao?: string | null
          id?: string
          registrado_por: string
          request_id: string
          seq?: never
          status?: string
          valor_centavos: number
        }
        Update: {
          cliente_id?: string
          data_movimento?: string
          data_registro?: string
          descricao?: string | null
          id?: string
          registrado_por?: string
          request_id?: string
          seq?: never
          status?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'consumos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'consumos_registrado_por_fkey'
            columns: ['registrado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      creditos: {
        Row: {
          cliente_id: string
          data_movimento: string
          data_registro: string
          id: string
          movimento_vinculado_id: string | null
          origem_pagamento_id: string | null
          registrado_por: string
          request_id: string
          seq: number
          status: string
          tipo: string
          valor_centavos: number
        }
        Insert: {
          cliente_id: string
          data_movimento: string
          data_registro?: string
          id?: string
          movimento_vinculado_id?: string | null
          origem_pagamento_id?: string | null
          registrado_por: string
          request_id: string
          seq?: never
          status?: string
          tipo: string
          valor_centavos: number
        }
        Update: {
          cliente_id?: string
          data_movimento?: string
          data_registro?: string
          id?: string
          movimento_vinculado_id?: string | null
          origem_pagamento_id?: string | null
          registrado_por?: string
          request_id?: string
          seq?: never
          status?: string
          tipo?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'creditos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'creditos_origem_pagamento_id_fkey'
            columns: ['origem_pagamento_id']
            isOneToOne: false
            referencedRelation: 'pagamentos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'creditos_registrado_por_fkey'
            columns: ['registrado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      dinheiro_inicial: {
        Row: {
          atualizado_em: string
          data: string
          data_registro: string
          editado_por: string
          id: string
          request_id: string
          seq: number
          valor_centavos: number
        }
        Insert: {
          atualizado_em?: string
          data: string
          data_registro?: string
          editado_por: string
          id?: string
          request_id: string
          seq?: never
          valor_centavos?: number
        }
        Update: {
          atualizado_em?: string
          data?: string
          data_registro?: string
          editado_por?: string
          id?: string
          request_id?: string
          seq?: never
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'dinheiro_inicial_editado_por_fkey'
            columns: ['editado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      historico_alteracoes: {
        Row: {
          alterado_em: string
          alterado_por: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          registro_id: string
          tabela: string
        }
        Insert: {
          alterado_em?: string
          alterado_por: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          registro_id: string
          tabela: string
        }
        Update: {
          alterado_em?: string
          alterado_por?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          registro_id?: string
          tabela?: string
        }
        Relationships: [
          {
            foreignKeyName: 'historico_alteracoes_alterado_por_fkey'
            columns: ['alterado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      pagamentos: {
        Row: {
          cliente_id: string
          credito_id: string | null
          data_movimento: string
          data_registro: string
          forma: string
          id: string
          registrado_por: string
          request_id: string
          seq: number
          status: string
          valor_centavos: number
        }
        Insert: {
          cliente_id: string
          credito_id?: string | null
          data_movimento: string
          data_registro?: string
          forma: string
          id?: string
          registrado_por: string
          request_id: string
          seq?: never
          status?: string
          valor_centavos: number
        }
        Update: {
          cliente_id?: string
          credito_id?: string | null
          data_movimento?: string
          data_registro?: string
          forma?: string
          id?: string
          registrado_por?: string
          request_id?: string
          seq?: never
          status?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'pagamentos_cliente_id_fkey'
            columns: ['cliente_id']
            isOneToOne: false
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pagamentos_credito_id_fkey'
            columns: ['credito_id']
            isOneToOne: false
            referencedRelation: 'creditos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pagamentos_registrado_por_fkey'
            columns: ['registrado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      password_reset_rate_limits: {
        Row: {
          created_at: string
          id: string
          identifier: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          categoria: string
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          preco_atual_centavos: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          categoria?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          preco_atual_centavos: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          categoria?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          preco_atual_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'produtos_atualizado_por_fkey'
            columns: ['atualizado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'produtos_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      retiradas_mercadoria: {
        Row: {
          consumidor: string
          data_movimento: string
          data_registro: string
          descricao: string
          id: string
          registrado_por: string
          request_id: string
          seq: number
          status: string
          valor_centavos: number
        }
        Insert: {
          consumidor: string
          data_movimento: string
          data_registro?: string
          descricao: string
          id?: string
          registrado_por: string
          request_id: string
          seq?: never
          status?: string
          valor_centavos: number
        }
        Update: {
          consumidor?: string
          data_movimento?: string
          data_registro?: string
          descricao?: string
          id?: string
          registrado_por?: string
          request_id?: string
          seq?: never
          status?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'retiradas_mercadoria_registrado_por_fkey'
            columns: ['registrado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
      saidas: {
        Row: {
          data_movimento: string
          data_registro: string
          descricao: string
          id: string
          origem: string
          registrado_por: string
          request_id: string
          seq: number
          status: string
          valor_centavos: number
          vinculo_credito_id: string | null
        }
        Insert: {
          data_movimento: string
          data_registro?: string
          descricao: string
          id?: string
          origem: string
          registrado_por: string
          request_id: string
          seq?: never
          status?: string
          valor_centavos: number
          vinculo_credito_id?: string | null
        }
        Update: {
          data_movimento?: string
          data_registro?: string
          descricao?: string
          id?: string
          origem?: string
          registrado_por?: string
          request_id?: string
          seq?: never
          status?: string
          valor_centavos?: number
          vinculo_credito_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'saidas_registrado_por_fkey'
            columns: ['registrado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'saidas_vinculo_credito_id_fkey'
            columns: ['vinculo_credito_id']
            isOneToOne: false
            referencedRelation: 'creditos'
            referencedColumns: ['id']
          },
        ]
      }
      vendas_diretas: {
        Row: {
          data_movimento: string
          data_registro: string
          descricao: string
          forma: string
          id: string
          registrado_por: string
          request_id: string
          seq: number
          status: string
          valor_centavos: number
        }
        Insert: {
          data_movimento: string
          data_registro?: string
          descricao: string
          forma: string
          id?: string
          registrado_por: string
          request_id: string
          seq?: never
          status?: string
          valor_centavos: number
        }
        Update: {
          data_movimento?: string
          data_registro?: string
          descricao?: string
          forma?: string
          id?: string
          registrado_por?: string
          request_id?: string
          seq?: never
          status?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'vendas_diretas_registrado_por_fkey'
            columns: ['registrado_por']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_change_user_status: {
        Args: { p_ativo: boolean; p_target_user_id: string }
        Returns: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          deve_alterar_senha: boolean
          id: string
          nome: string
          perfil: string
          username: string
        }
        SetofOptions: {
          from: '*'
          to: 'app_users'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_mark_password_reset: {
        Args: { p_target_user_id: string }
        Returns: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          deve_alterar_senha: boolean
          id: string
          nome: string
          perfil: string
          username: string
        }
        SetofOptions: {
          from: '*'
          to: 'app_users'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      alterar_preco_excepcional_item: {
        Args: {
          p_item_id: string
          p_justificativa: string
          p_novo_preco_centavos: number
        }
        Returns: Json
      }
      atualizar_comanda_identificacao: {
        Args: {
          p_cliente_id?: string
          p_comanda_id: string
          p_identificacao: string
          p_local_referencia: string
          p_mesa: string
        }
        Returns: Json
      }
      calcular_posicao_cliente: {
        Args: { p_cliente_id: string }
        Returns: {
          credito_devolvido: number
          credito_disponivel: number
          credito_origem: number
          credito_utilizado: number
          saldo_devedor: number
          total_divida: number
          total_pago: number
        }[]
      }
      cancelar_consumo_fiado: {
        Args: { p_consumo_id: string; p_motivo?: string }
        Returns: Json
      }
      cancelar_devolucao_credito: {
        Args: { p_credito_devolucao_id: string; p_motivo?: string }
        Returns: Json
      }
      cancelar_fechamento_comanda: {
        Args: { p_comanda_id: string; p_motivo?: string }
        Returns: Json
      }
      cancelar_item_comanda: {
        Args: { p_item_id: string; p_motivo?: string }
        Returns: Json
      }
      cancelar_pagamento_fiado: {
        Args: { p_motivo?: string; p_pagamento_id: string }
        Returns: Json
      }
      cancelar_retirada_mercadoria: {
        Args: { p_motivo?: string; p_retirada_id: string }
        Returns: Json
      }
      cancelar_saida: {
        Args: { p_motivo?: string; p_saida_id: string }
        Returns: Json
      }
      cancelar_venda_direta: {
        Args: { p_motivo?: string; p_venda_id: string }
        Returns: Json
      }
      check_email_disponivel: { Args: { p_email: string }; Returns: boolean }
      complete_first_access: {
        Args: never
        Returns: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          deve_alterar_senha: boolean
          id: string
          nome: string
          perfil: string
          username: string
        }
        SetofOptions: {
          from: '*'
          to: 'app_users'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      editar_consumo_fiado: {
        Args: {
          p_consumo_id: string
          p_nova_data_movimento: string
          p_nova_descricao: string
          p_novo_cliente_id?: string
          p_novo_valor_centavos: number
        }
        Returns: Json
      }
      editar_pagamento_fiado: {
        Args: {
          p_nova_data_movimento: string
          p_nova_forma: string
          p_novo_valor_centavos: number
          p_pagamento_id: string
        }
        Returns: Json
      }
      editar_retirada_mercadoria: {
        Args: {
          p_nova_data_movimento: string
          p_nova_descricao: string
          p_novo_consumidor: string
          p_novo_valor_centavos: number
          p_retirada_id: string
        }
        Returns: Json
      }
      editar_saida: {
        Args: {
          p_nova_data_movimento: string
          p_nova_descricao: string
          p_nova_origem: string
          p_novo_valor_centavos: number
          p_saida_id: string
        }
        Returns: Json
      }
      editar_venda_direta: {
        Args: {
          p_nova_data_movimento: string
          p_nova_descricao: string
          p_nova_forma: string
          p_novo_valor_centavos: number
          p_venda_id: string
        }
        Returns: Json
      }
      fechar_comanda: {
        Args: { p_comanda_id: string; p_parcelas: Json; p_request_id?: string }
        Returns: Json
      }
      is_active_admin: { Args: { p_user_id?: string }; Returns: boolean }
      lancar_item_comanda: {
        Args: {
          p_comanda_id: string
          p_produto_id: string
          p_quantidade: number
          p_request_id?: string
        }
        Returns: Json
      }
      recalcular_cliente_cronologico: {
        Args: { p_cliente_id: string }
        Returns: Json
      }
      registrar_consumo_com_credito: {
        Args: {
          p_cliente_id: string
          p_data_movimento: string
          p_descricao?: string
          p_request_id?: string
          p_valor_centavos: number
        }
        Returns: Json
      }
      registrar_devolucao_credito: {
        Args: {
          p_cliente_id: string
          p_data_movimento: string
          p_forma_devolucao: string
          p_request_id?: string
          p_valor_centavos: number
        }
        Returns: Json
      }
      registrar_pagamento_fiado: {
        Args: {
          p_cliente_id: string
          p_data_movimento: string
          p_forma: string
          p_request_id?: string
          p_valor_centavos: number
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
