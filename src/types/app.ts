export type AppUser = {
  id: string
  username: string
  nome: string
  ativo: boolean
  deve_alterar_senha: boolean
  perfil: 'administrador'
  criado_em?: string
  atualizado_em?: string
}

export type AdminOperation =
  | { operation: 'create'; nome: string; username: string }
  | { operation: 'reset-password'; targetUserId: string }
  | { operation: 'deactivate'; targetUserId: string }
  | { operation: 'reactivate'; targetUserId: string }

export type AdminOperationResult = {
  user?: AppUser
  provisionalPassword?: string
  alreadyExists?: boolean
}
