import ProgramaFidelidadeGenerico from '../components/ProgramaFidelidadeGenerico';

export default function Accor() {
  return (
    <ProgramaFidelidadeGenerico
      config={{
        nome: 'Accor',
        tabela: 'accor_membros',
        temStatusPrograma: true
      }}
    />
  );
}
