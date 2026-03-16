import ProgramaFidelidadeGenerico from '../components/ProgramaFidelidadeGenerico';

export default function Livelo() {
  return (
    <ProgramaFidelidadeGenerico
      config={{
        nome: 'Livelo',
        tabela: 'livelo_membros',
        temStatusPrograma: true
      }}
    />
  );
}
