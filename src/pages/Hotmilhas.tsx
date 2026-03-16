import ProgramaFidelidadeGenerico from '../components/ProgramaFidelidadeGenerico';

export default function Hotmilhas() {
  return (
    <ProgramaFidelidadeGenerico
      config={{
        nome: 'Hotmilhas',
        tabela: 'hotmilhas_membros',
        temStatusPrograma: true
      }}
    />
  );
}
