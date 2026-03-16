import ProgramaFidelidadeGenerico from '../components/ProgramaFidelidadeGenerico';

export default function KM() {
  return (
    <ProgramaFidelidadeGenerico
      config={{
        nome: 'KM',
        tabela: 'km_membros',
        temStatusPrograma: true
      }}
    />
  );
}
