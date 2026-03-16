import ProgramaFidelidadeGenerico from '../components/ProgramaFidelidadeGenerico';

export default function Tap() {
  return (
    <ProgramaFidelidadeGenerico
      config={{
        nome: 'TAP',
        tabela: 'tap_membros',
        temStatusPrograma: true
      }}
    />
  );
}
