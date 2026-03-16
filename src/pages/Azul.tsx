import ProgramaFidelidadeGenerico from '../components/ProgramaFidelidadeGenerico';

export default function Azul() {
  return (
    <ProgramaFidelidadeGenerico
      config={{
        nome: 'Azul',
        tabela: 'azul_membros',
        temStatusPrograma: true
      }}
    />
  );
}
