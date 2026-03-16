import ProgramaFidelidadeGenerico from '../components/ProgramaFidelidadeGenerico';

export default function Coopera() {
  return (
    <ProgramaFidelidadeGenerico
      config={{
        nome: 'Coopera',
        tabela: 'coopera_membros',
        temStatusPrograma: true
      }}
    />
  );
}
