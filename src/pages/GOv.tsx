import ProgramaFidelidadeGenerico from '../components/ProgramaFidelidadeGenerico';

export default function GOv() {
  return (
    <ProgramaFidelidadeGenerico
      config={{
        nome: 'GOv',
        tabela: 'gov_membros',
        temStatusPrograma: true
      }}
    />
  );
}
