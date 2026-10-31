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
      is_active_admin: { Args: { p_user_id?: string }; Returns: boolean }
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
